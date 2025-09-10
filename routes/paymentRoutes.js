import express from "express";
import Stripe from "stripe";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

dotenv.config();

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create Payment Intent
router.post("/create-payment-intent", async (req, res) => {
  try {
    const { amount, customerInfo, cartItems } = req.body;

    const stripeAmount = Math.round(amount * 100);
    console.log("Stripe amount:", stripeAmount);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: stripeAmount,
      currency: "gbp",
      metadata: {
        customer_name: customerInfo.name,
        customer_email: customerInfo.email,
        customer_phone: customerInfo.phone,
        customer_address: JSON.stringify(customerInfo.address),
        cart_items: JSON.stringify(cartItems),
      },
    });

    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    res.status(500).json({ error: "Something went wrong with payment." });
  }
});

// Nodemailer Config
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Send Receipt
router.post("/send-receipt", async (req, res) => {
  try {
    const { customerInfo, cartItems, totalPrice } = req.body;
    // console.log(cartItems);

    const receiptHTML = `
      <html>
  <head>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; }
      .receipt { width: 250px; text-align: center; }
      .header { font-size: 16px; font-weight: bold; }
      .line { border-bottom: 1px dashed #000; margin: 5px 0; }
      .item { text-align: left; margin-bottom: 10px; }
      .item-title { font-weight: bold; }
      .subpoints { font-size: 10px; margin-left: 10px; }
      .logo { max-width: 100px; margin: 0 auto 10px; }
    </style>
  </head>
  <body>
    <div class="receipt">
      <img src="./tvpLogo.png" alt="Logo" class="logo" />
      <div class="header">THE VILLAGE PIZZERIA</div>
      <div class="line"></div>
      <p>Order ID: ${Math.floor(Math.random() * 100000)}</p>
      <p>Customer: ${customerInfo.name}</p>
      <p>Email: ${customerInfo.email}</p>
      <p>Phone: ${customerInfo.phone}</p>
      <div class="line"></div>
      ${cartItems
        .map(
          (item) => `
          <div class="item">
            <div class="item-title">${item.title} x${item.itemQuantity}</div>
            ${
              item.size ? `<div class="subpoints">Size: ${item.size}</div>` : ""
            }
            ${
              item.crust
                ? `<div class="subpoints">Crust: ${item.crust}</div>`
                : ""
            }
            ${
              item.base.length > 0
                ? `<div class="subpoints">Base: ${item.base.join(", ")}</div>`
                : ""
            }
            ${
              item.toppings.length > 0
                ? `<div class="subpoints">Toppings: ${item.toppings.join(
                    ", "
                  )}</div>`
                : ""
            }
            <div style="text-align: right;"><strong>£${
              item.totalPrice
            }</strong></div>
          </div>`
        )
        .join("")}
      <div class="line"></div>
      <p><strong>Products count: ${cartItems.length}</strong></p>
      <p><strong>Total: £${totalPrice}</strong></p>
      <p>Thank you for your order!</p>
    </div>
  </body>
</html>
    `;

    // Send Email Receipt
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: customerInfo.email,
      subject: "Your Order Receipt",
      html: receiptHTML,
    });

    console.log("Email receipt sent to:", customerInfo.email);

    res.json({ success: true, message: "Receipt sent successfully" });
  } catch (error) {
    console.error("Error sending receipt:", error);
    res.status(500).json({ error: "Failed to send receipt." });
  }
});

export default router;
