import type { Booking } from './booking';
import { lessonState } from './progress';
import type { Profile } from './types';
import FIELDS from './inCarFields.json';

/** One fillable box on the in-car sheet. r = [left, top, width, height] in PDF points from the page's top-left. */
export type SheetField =
  | { n: string; t: 'tx'; p: number; r: number[]; d: string; ml?: boolean }
  | { n: string; t: 'ch'; p: number; r: number[]; d: string; o: string[] }
  | { n: string; t: 'radio'; p: number; r: number[]; d: string; s: string };

export const SHEET_FIELDS = FIELDS as SheetField[];
export const PAGE_W = 612;
export const PAGE_H = 792;
export const PAGE_IMAGES = ['/in-car/page1.jpg', '/in-car/page2.jpg'];

export type Answers = Record<string, string>;

const pad = (n: number) => String(n).padStart(2, '0');

/** "2027-05-31" → "05/31/2027", as the sheet's dates are written. */
function sheetDate(day: string | null | undefined) {
  if (!day) return '';
  const [y, m, d] = day.split('-');
  return `${m}/${d}/${y}`;
}

function sheetTime(iso: string) {
  const d = new Date(iso);
  const h = d.getHours();
  return `${h % 12 || 12}:${pad(d.getMinutes())}${h < 12 ? 'am' : 'pm'}`;
}

/** What the app already knows: student details, instructor details and the first 10 finished lessons. */
export function autoFill(student: Profile, instructor: Profile | null, lessons: Booking[]): Answers {
  const [first, ...rest] = (student.full_name ?? '').trim().split(/\s+/);
  const a: Answers = {
    'Last name': student.last_name ?? rest.join(' '),
    'First name': student.first_name ?? first ?? '',
    Address: student.address ?? '',
    'Postal code': student.postal_code ?? '',
    "Driver's licence number": student.license_number ?? '',
    'Issue date': sheetDate(student.license_issue_date),
    'Expiry date': sheetDate(student.license_expiry),
    'Phone number': student.phone ?? '',
    'Email address': student.email ?? '',
  };
  if (instructor) {
    a['Driving instructor name'] = instructor.full_name ?? '';
    a['Driving instructor number'] = instructor.di_number ?? '';
    a['DI phone number'] = instructor.phone ?? '';
    a['DI licence expiry year'] = instructor.di_licence_expiry_year ?? '';
  }
  const done = lessons
    .filter((b) => lessonState(b) === 'done')
    .sort((x, y) => Date.parse(x.starts_at) - Date.parse(y.starts_at))
    .slice(0, 10);
  done.forEach((b, i) => {
    const d = new Date(b.starts_at);
    a[`Date${i + 1}`] = `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
    a[`Start time${i + 1}`] = sheetTime(b.starts_at);
    a[`Finish time${i + 1}`] = sheetTime(b.ends_at);
  });
  return a;
}

/** The value shown for a field: what the instructor typed, else what the app knows, else the form's own default. */
export function valueOf(name: string, saved: Answers, auto: Answers, formDefault: string) {
  if (name in saved) return saved[name];
  if (auto[name]) return auto[name];
  return formDefault;
}

/** Fill the real PDF form with these values and download it (website only). */
export async function downloadSheetPdf(values: Answers, fileName: string) {
  // The ready-made bundles avoid a module-format clash in the website build.
  const [lib, fk] = await Promise.all([
    import('pdf-lib/dist/pdf-lib.min.js') as Promise<unknown>,
    import('@pdf-lib/fontkit/dist/fontkit.umd.min.js') as Promise<unknown>,
  ]);
  const { PDFDocument, PDFName } = ((lib as { default?: unknown }).default ?? lib) as typeof import('pdf-lib');
  const fontkit = ((fk as { default?: unknown }).default ?? fk) as object;
  const [pdfBytes, fontBytes] = await Promise.all([
    fetch('/in-car/in-car-sheet.pdf').then((r) => r.arrayBuffer()),
    fetch('/in-car/DejaVuSans.ttf').then((r) => r.arrayBuffer()),
  ]);
  const doc = await PDFDocument.load(pdfBytes);
  doc.registerFontkit(fontkit as never);
  const font = await doc.embedFont(fontBytes, { subset: true });
  const form = doc.getForm();
  const done = new Set<string>();

  for (const f of SHEET_FIELDS) {
    if (done.has(f.n)) continue;
    done.add(f.n);
    const v = values[f.n] ?? '';
    try {
      if (f.t === 'tx') {
        const tf = form.getTextField(f.n);
        const max = tf.getMaxLength();
        tf.setText(max ? v.slice(0, max) : v);
        // Even, readable text: sized to the box, smaller for the remarks box. The school name keeps its big heading size.
        if (f.n !== 'Driving school name') tf.setFontSize(f.ml ? 9 : Math.max(6, Math.min(f.r[3] * 0.62, 10)));
        tf.updateAppearances(font);
      } else if (f.t === 'ch') {
        const dd = form.getDropdown(f.n);
        const opt = dd.getOptions().find((o) => o === v) ?? dd.getOptions().find((o) => o.trim() === v.trim());
        if (opt !== undefined && v.trim()) dd.select(opt);
        else dd.clear();
        dd.updateAppearances(font);
      } else {
        const rg = form.getRadioGroup(f.n);
        rg.acroField.dict.set(PDFName.of('V'), PDFName.of(v || 'Off'));
        for (const w of rg.acroField.getWidgets()) {
          const on = w.getOnValue();
          w.setAppearanceState(on && v && on.toString() === `/${v}` ? on : PDFName.of('Off'));
        }
      }
    } catch (e) {
      console.warn('[in-car] could not fill', f.n, e);
    }
  }

  const bytes = await doc.save();
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
