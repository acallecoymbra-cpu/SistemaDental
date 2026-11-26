import { Injectable, Logger } from '@nestjs/common';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Error con un código corto y estable (es lo único que se guarda del fallo, nunca el detalle). */
export class MailError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Puerto de salida de correo. El proveedor real (SMTP, Resend, etc.) se elige al desplegar y
 * se conecta aquí sin tocar el resto del sistema.
 */
export abstract class Mailer {
  /** Envía un correo; lanza si no pudo enviarlo. */
  abstract send(message: MailMessage): Promise<void>;
}

/**
 * Mientras no haya proveedor de correo, NO finge enviar: falla con `mail_not_configured`.
 * Así el aviso queda como «fallido» en la agenda y la doctora sabe que debe avisar por WhatsApp.
 * En el log no va el contenido ni el correo completo.
 */
@Injectable()
export class UnconfiguredMailer extends Mailer {
  private readonly logger = new Logger('Mailer');

  send(message: MailMessage): Promise<void> {
    const domain = message.to.split('@')[1] ?? '?';
    this.logger.warn(`Correo no enviado: no hay proveedor configurado (destino ***@${domain}).`);
    return Promise.reject(new MailError('mail_not_configured', 'Sin proveedor de correo.'));
  }
}
