import { test, expect } from '@playwright/test';

test.describe('E2E User Flow', () => {
  const clientEmail = `client_e2e_${Date.now()}@example.com`;
  const clientPassword = 'ClientPassword123!';
  const adminEmail = 'admin_e2e@example.com';
  const adminPassword = 'AdminPassword123!';

  test('should complete the full user journey: Register -> Login -> Add to Cart -> Checkout -> Admin Verification', async ({ page }) => {
    // 1. Inscription d'un nouveau compte
    console.log('1. Navigating to registration page...');
    await page.goto('/register');
    
    console.log('Filling in registration form...');
    await page.fill('#register-name', 'Client E2E');
    await page.fill('#register-email', clientEmail);
    await page.fill('#register-password', clientPassword);
    await page.fill('#register-confirm', clientPassword);
    await page.click('#btn-register');

    // Wait to be redirected to /menu
    console.log('Waiting for redirection to menu...');
    await page.waitForURL('**/menu');
    await expect(page.locator('#btn-logout')).toBeVisible();

    // 2. Déconnexion
    console.log('Logging out client user...');
    await page.click('#btn-logout');
    await page.waitForURL('**/login');

    // 3. Connexion
    console.log('Logging back in as the created client...');
    await page.fill('#login-email', clientEmail);
    await page.fill('#login-password', clientPassword);
    await page.click('#btn-login');

    // Wait to be redirected to /menu
    await page.waitForURL('**/menu');

    // 4. Ajout au panier
    console.log('Adding an item to the cart...');
    const addButton = page.locator('button[id^="add-"]').first();
    await expect(addButton).toBeVisible();
    await addButton.click();

    // Wait for Cart FAB to appear and open the cart
    console.log('Opening the cart...');
    const cartFab = page.locator('#btn-open-cart');
    await expect(cartFab).toBeVisible();
    await cartFab.click();

    // 5. Validation de commande
    console.log('Proceeding to checkout...');
    // Step 1: Click Continue to delivery
    await page.locator('.cart-modal-footer button.btn-primary:has-text("Continuer")').click();

    // Step 2: Delivery mode (default is Pickup "À emporter"). Click Continue to Payment
    await page.locator('.cart-modal-footer button.btn-primary:has-text("Paiement")').click();

    // Step 3: Payment. Choose Cash ("Espèces")
    console.log('Selecting payment method...');
    await page.locator('button:has-text("Espèces")').click();

    // Listen to orders creation network call to extract orderId
    const responsePromise = page.waitForResponse(response =>
      response.url().includes('/api/orders') && response.request().method() === 'POST'
    );

    console.log('Confirming and paying...');
    await page.locator('.cart-modal-footer button.btn-primary:has-text("Confirmer")').click();

    const response = await responsePromise;
    const responseBody = await response.json();
    const orderId = responseBody.id;
    console.log(`Order created successfully with ID: ${orderId}`);

    // Wait for step 4 success page to show
    await expect(page.locator('h4:has-text("Paiement approuvé")')).toBeVisible();

    // Close the success modal
    console.log('Closing success modal...');
    await page.locator('button:has-text("Fermer")').click();

    // 6. Déconnexion
    console.log('Logging out client...');
    await page.click('#btn-logout');
    await page.waitForURL('**/login');

    // 7. Connexion en tant qu'administrateur
    console.log('Logging in as administrator...');
    await page.fill('#login-email', adminEmail);
    await page.fill('#login-password', adminPassword);
    await page.click('#btn-login');
    await page.waitForURL('**/menu');

    // 8. Vérification de sa présence dans la page d'administration
    console.log('Navigating to Admin Dashboard...');
    await page.goto('/dashboard');
    await page.waitForURL('**/dashboard');

    console.log(`Locating order row: #row-${orderId}...`);
    const orderRow = page.locator(`#row-${orderId}`);
    await expect(orderRow).toBeVisible();
    console.log('🎉 E2E Flow verified successfully!');
  });
});
