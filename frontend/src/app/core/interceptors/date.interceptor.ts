import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs/operators';

/** ISO string à minuit UTC exact, ex. 2026-10-01T00:00:00.000Z ou 2026-10-01T00:00:00Z */
const UTC_MIDNIGHT_ISO = /^(\d{4})-(\d{2})-(\d{2})T00:00:00(\.000)?Z$/;

/**
 * Sérialise une Date en préservant le wall-clock local, marqué UTC.
 * Un p-datepicker crée une Date à minuit LOCAL ; on veut que le backend reçoive
 * le même jour/heure "tel quel", sans décalage introduit par toISOString().
 */
function serializeDate(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString();
}

/** Convertit récursivement les Date d'un body sortant en ISO "wall-clock local marqué UTC". */
function convertOutgoing(obj: unknown): unknown {
  if (obj instanceof Date) return serializeDate(obj);
  if (Array.isArray(obj)) return obj.map(convertOutgoing);
  if (obj !== null && typeof obj === 'object' && obj.constructor === Object) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, convertOutgoing(v)])
    );
  }
  return obj;
}

/**
 * Convertit récursivement les strings ISO à minuit UTC exact d'un body entrant en
 * Date locale à minuit. Les vrais timestamps (heure ≠ 00:00:00Z) restent des strings.
 */
function convertIncoming(obj: unknown): unknown {
  if (typeof obj === 'string') {
    const m = UTC_MIDNIGHT_ISO.exec(obj);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]); // minuit LOCAL
    return obj;
  }
  if (Array.isArray(obj)) return obj.map(convertIncoming);
  if (obj !== null && typeof obj === 'object' && obj.constructor === Object) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, convertIncoming(v)])
    );
  }
  return obj;
}

/**
 * Corrige le décalage de date introduit par PrimeNG p-datepicker (Date locale minuit
 * → toISOString() bascule au jour précédent en UTC+). Voir docs/... ou la PR associée
 * pour le contexte complet.
 */
export const dateInterceptor: HttpInterceptorFn = (req, next) => {
  let request = req;
  if (req.body && typeof req.body === 'object') {
    request = req.clone({ body: convertOutgoing(req.body) });
  }
  return next(request).pipe(
    map(event =>
      event instanceof HttpResponse && event.body && typeof event.body === 'object'
        ? event.clone({ body: convertIncoming(event.body) })
        : event
    )
  );
};
