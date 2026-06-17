import nodemailer from 'nodemailer'

const createTransport = async () => {
  const host = process.env['SMTP_HOST']
  const port = process.env['SMTP_PORT']
  const user = process.env['SMTP_USER']
  const pass = process.env['SMTP_PASS']

  if (host && port && user && pass) {
    return nodemailer.createTransport({
      host,
      port: parseInt(port),
      secure: parseInt(port) === 465,
      auth: { user, pass },
    })
  }

  // Fallback: Ethereal Mail (automatic test SMTP)
  try {
    const testAccount = await nodemailer.createTestAccount()
    console.log('✉️ Compte de messagerie Ethereal créé automatiquement pour le test.')
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    })
  } catch (error) {
    console.warn('⚠️ Impossible de créer un compte Ethereal. Fallback sur un mock console.')
    return null
  }
}

let transportPromise = createTransport()

export const sendEmail = async (to: string, subject: string, html: string) => {
  const transport = await transportPromise
  if (!transport) {
    console.log(`[EMAIL MOCK] A: ${to}\nSUJET: ${subject}\nCONTENU: \n${html}\n[FIN EMAIL MOCK]`)
    return
  }

  try {
    const info = await transport.sendMail({
      from: `"RestauApp" <no-reply@restauapp.com>`,
      to,
      subject,
      html,
    })

    console.log(`✉️ Email envoyé: ${info.messageId}`)
    const previewUrl = nodemailer.getTestMessageUrl(info)
    if (previewUrl) {
      console.log(`✉️ Lien de prévisualisation: ${previewUrl}`)
    }
  } catch (error) {
    console.error("❌ Erreur lors de l'envoi de l'email:", error)
  }
}

export const sendOrderConfirmationEmail = async (order: any, customerEmail: string, customerName: string) => {
  const orderShortId = order.id.slice(-6).toUpperCase()
  const itemsHtml = order.items
    .map(
      (item: any) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.item.name} ${item.note ? `<i>(${item.note})</i>` : ''}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">x${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">${(item.unitPrice * item.quantity).toFixed(2)} €</td>
      </tr>`
    )
    .join('')

  const deliveryAddress = order.delivery ? order.delivery.deliveryAddress : 'Sur place'
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6; border: 1px solid #eee; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
      <div style="background-color: #f97316; padding: 20px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 24px;">RestauApp</h1>
        <p style="margin: 5px 0 0 0; font-size: 16px;">Confirmation de commande</p>
      </div>
      <div style="padding: 20px;">
        <p>Bonjour <strong>${customerName}</strong>,</p>
        <p>Merci pour votre commande ! Notre équipe s'occupe de tout et commence à la préparer.</p>
        
        <div style="background-color: #f7f7f7; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #f97316;">Récapitulatif de la commande #${orderShortId}</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #eaeaea;">
                <th style="padding: 10px; text-align: left;">Plat</th>
                <th style="padding: 10px; text-align: center;">Qté</th>
                <th style="padding: 10px; text-align: right;">Prix</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="padding: 10px; font-weight: bold; text-align: right;">Total</td>
                <td style="padding: 10px; font-weight: bold; text-align: right; color: #f97316;">${order.totalAmount.toFixed(2)} €</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p><strong>Mode de retrait / Adresse de livraison :</strong><br/>
        ${deliveryAddress}</p>

        <p style="margin-top: 30px;">Bon appétit !<br/>L'équipe RestauApp</p>
      </div>
      <div style="background-color: #eaeaea; padding: 15px; text-align: center; font-size: 12px; color: #666;">
        Vous recevez cet email suite à votre commande sur RestauApp.
      </div>
    </div>
  `

  await sendEmail(customerEmail, `Confirmation de votre commande #${orderShortId} - RestauApp`, html)
}

export const sendDeliveryRecapEmail = async (order: any, customerEmail: string, customerName: string) => {
  const orderShortId = order.id.slice(-6).toUpperCase()
  const itemsHtml = order.items
    .map(
      (item: any) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.item.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">x${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">${(item.unitPrice * item.quantity).toFixed(2)} €</td>
      </tr>`
    )
    .join('')

  const delivererName = order.delivery && order.delivery.deliverer ? order.delivery.deliverer.name : 'Notre livreur'

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6; border: 1px solid #eee; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
      <div style="background-color: #22c55e; padding: 20px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 24px;">RestauApp</h1>
        <p style="margin: 5px 0 0 0; font-size: 16px;">Votre commande est livrée !</p>
      </div>
      <div style="padding: 20px;">
        <p>Bonjour <strong>${customerName}</strong>,</p>
        <p>Bonne nouvelle ! <strong>${delivererName}</strong> vient de livrer votre commande à l'adresse indiquée.</p>
        
        <div style="background-color: #f7f7f7; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #22c55e;">Détails de la livraison #${orderShortId}</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #eaeaea;">
                <th style="padding: 10px; text-align: left;">Plat</th>
                <th style="padding: 10px; text-align: center;">Qté</th>
                <th style="padding: 10px; text-align: right;">Prix</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="padding: 10px; font-weight: bold; text-align: right;">Total payé</td>
                <td style="padding: 10px; font-weight: bold; text-align: right; color: #22c55e;">${order.totalAmount.toFixed(2)} €</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <p>Nous espérons que le repas vous plaira ! N'hésitez pas à laisser un avis sur notre application.</p>

        <p style="margin-top: 30px;">À très bientôt !<br/>L'équipe RestauApp</p>
      </div>
      <div style="background-color: #eaeaea; padding: 15px; text-align: center; font-size: 12px; color: #666;">
        Pour toute assistance, contactez notre support client.
      </div>
    </div>
  `

  await sendEmail(customerEmail, `Votre commande #${orderShortId} a été livrée ! - RestauApp`, html)
}

export const sendPasswordResetEmail = async (email: string, token: string, name: string) => {
  const frontendUrl = process.env['FRONTEND_URL'] || 'http://localhost:5173'
  const resetUrl = `${frontendUrl}/reset-password?token=${token}`

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333; line-height: 1.6; border: 1px solid #eee; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
      <div style="background-color: #f97316; padding: 20px; text-align: center; color: white;">
        <h1 style="margin: 0; font-size: 24px;">RestauApp</h1>
        <p style="margin: 5px 0 0 0; font-size: 16px;">Réinitialisation de mot de passe</p>
      </div>
      <div style="padding: 20px;">
        <p>Bonjour <strong>${name}</strong>,</p>
        <p>Vous avez demandé la réinitialisation de votre mot de passe pour votre compte RestauApp.</p>
        <p>Pour définir un nouveau mot de passe, veuillez cliquer sur le bouton ci-dessous :</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">Réinitialiser mon mot de passe</a>
        </div>

        <p>Ou copiez et collez le lien suivant dans votre navigateur :<br/>
        <a href="${resetUrl}" style="color: #f97316;">${resetUrl}</a></p>

        <p style="color: #666; font-size: 13px; margin-top: 20px;">Ce lien expirera dans 60 minutes. Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email en toute sécurité.</p>

        <p style="margin-top: 30px;">Cordialement,<br/>L'équipe RestauApp</p>
      </div>
      <div style="background-color: #eaeaea; padding: 15px; text-align: center; font-size: 12px; color: #666;">
        Ceci est un email automatique, merci de ne pas y répondre.
      </div>
    </div>
  `

  await sendEmail(email, 'Réinitialisation de votre mot de passe - RestauApp', html)
}
