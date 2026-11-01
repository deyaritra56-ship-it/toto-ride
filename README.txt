TOTO RIDE - TWO SEPARATE SITES + BACKEND

FILES
- customer.html: customer booking website
- owner.html: private owner dashboard
- server.js: backend API, booking storage, owner login, SMS hook
- .env.example: configuration placeholders

RUN LOCALLY (Node.js 18+)
1. Copy this folder to a computer/server with Node.js.
2. Set environment variables from .env.example (do not publish secrets).
3. Set a strong ADMIN_PASSWORD.
4. Configure MSG91 credentials and an approved DLT SMS template.
5. Run: node server.js
6. Customer site: http://localhost:3000/
7. Owner site: http://localhost:3000/owner

OWNER SMS
Owner destination number is configured as 8371908909. For Indian SMS, server prepends country code 91.
The SMS function uses MSG91 Flow API. You must create an MSG91 account, complete sender/DLT setup, get an approved template and fill in MSG91_AUTHKEY, MSG91_TEMPLATE_ID and MSG91_SENDER_ID. The sample template expects variables VAR1..VAR5: customer name, pickup, destination, customer phone, booking ID. Match these variables to your approved template.

PAYMENT
Owner UPI ID from supplied image: deyaritra56@oksbi (Aritra Dey).
Online booking QR is generated with the owner-entered fare. UPI QR prefills the amount; it does NOT prove payment. Verify in your UPI/bank app. Cash can be marked YES/NO by owner.
For automatic online-payment confirmation, integrate a payment gateway with server-side webhook verification.

IMPORTANT
- This is a deployable starter project, not a hosted live website. It will not send SMS until SMS credentials and DLT template are configured.
- Deploy the whole project to a Node.js hosting provider with HTTPS. Both sites must use the same backend URL/domain.
- Change the default admin password before deployment. Owner API uses a bearer token, but for a production business system add persistent sessions, stronger rate limiting, CSRF protections and database backups.
- Customer phone number is provided by the customer and included in the owner SMS. Handle personal data securely and publish a privacy notice.
- Never put SMS API keys or admin password in HTML/browser code. Never ask customers for UPI PIN or OTP.
