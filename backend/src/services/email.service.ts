import nodemailer from 'nodemailer'

// ─── Configuration du transporteur ────────────────────────────────────────────
// En développement : utilise Ethereal (faux serveur SMTP, les mails sont capturés
//                    et visibles sur https://ethereal.email — aucune vraie config SMTP nécessaire)
// En production   : utilise les variables SMTP_* définies dans le .env

const createTransporter = async () => {
  if (process.env.NODE_ENV !== 'production') {
    // Génère automatiquement un compte Ethereal jetable pour les tests
    const testAccount = await nodemailer.createTestAccount()
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    })
  }

  // Production : SMTP réel (Gmail, SendGrid, Brevo, etc.)
  return nodemailer.createTransport({
    host: process.env['SMTP_HOST'],
    port: Number(process.env['SMTP_PORT'] || 587),
    secure: process.env['SMTP_SECURE'] === 'true',
    auth: {
      user: process.env['SMTP_USER'],
      pass: process.env['SMTP_PASS'],
    },
  })
}

// ─── Envoi de l'email de réinitialisation de mot de passe ─────────────────────
export const sendPasswordResetEmail = async (
  toEmail: string,
  resetToken: string
): Promise<void> => {
  const frontendUrl = process.env['FRONTEND_URL'] || 'http://localhost:5173'
  const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`

  const transporter = await createTransporter()

  const mailOptions = {
    from: `"Fil Rouge Restaurant" <${process.env['SMTP_FROM'] || 'noreply@fil-rouge.fr'}>`,
    to: toEmail,
    subject: 'Réinitialisation de votre mot de passe',
    // Version texte brut (fallback)
    text: `
Bonjour,

Vous avez demandé la réinitialisation de votre mot de passe.

Cliquez sur le lien ci-dessous pour choisir un nouveau mot de passe (valable 60 minutes) :
${resetLink}

Si vous n'avez pas fait cette demande, ignorez cet email — votre mot de passe reste inchangé.

L'équipe Fil Rouge Restaurant
    `.trim(),
    // Version HTML
    html: `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 520px; margin: 40px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #ff6b35, #f7c59f); padding: 32px 24px; text-align: center; }
    .header h1 { color: #fff; margin: 0; font-size: 22px; letter-spacing: 1px; }
    .body { padding: 32px 24px; color: #333; }
    .body p { line-height: 1.6; margin: 0 0 16px; }
    .btn { display: inline-block; margin: 16px 0; padding: 14px 28px; background: #ff6b35; color: #fff !important; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; }
    .notice { font-size: 13px; color: #888; margin-top: 24px; border-top: 1px solid #eee; padding-top: 16px; }
    .footer { background: #f9f9f9; padding: 16px 24px; text-align: center; font-size: 12px; color: #aaa; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🍽️ Fil Rouge Restaurant</h1>
    </div>
    <div class="body">
      <p>Bonjour,</p>
      <p>Vous avez demandé la <strong>réinitialisation de votre mot de passe</strong>.</p>
      <p>Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe.<br/>
         Ce lien est valable <strong>60 minutes</strong>.</p>
      <p style="text-align:center;">
        <a href="${resetLink}" class="btn">Réinitialiser mon mot de passe</a>
      </p>
      <p class="notice">
        Si le bouton ne fonctionne pas, copiez-collez ce lien dans votre navigateur :<br/>
        <a href="${resetLink}" style="color:#ff6b35;">${resetLink}</a>
      </p>
      <p class="notice">
        Si vous n'avez pas demandé cette réinitialisation, ignorez cet email — votre mot de passe reste inchangé.
      </p>
    </div>
    <div class="footer">© ${new Date().getFullYear()} Fil Rouge Restaurant — Tous droits réservés</div>
  </div>
</body>
</html>
    `.trim(),
  }

  const info = await transporter.sendMail(mailOptions)

  // En dev : affiche l'URL Ethereal pour prévisualiser le mail dans le navigateur
  if (process.env.NODE_ENV !== 'production') {
    console.log(`📧 Email de reset envoyé à ${toEmail}`)
    console.log(`🔗 Prévisualisation Ethereal : ${nodemailer.getTestMessageUrl(info)}`)
  }
}
