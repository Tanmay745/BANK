require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

// Verify the connection configuration
transporter.verify((error, success) => {
  if (error) {
    console.error('Error connecting to email server:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

// Function to send email
const sendEmail = async (to, subject, text, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"Backend Ledger" <${process.env.EMAIL_USER}>`, // sender address
      to, // list of receivers
      subject, // Subject line
      text, // plain text body
      html, // html body
    });

    console.log('Message sent: %s', info.messageId);
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

async function sendRegistrationEmail(userEmail,name){
    const subject = 'Welcome to Backend Ledger!';
    const text = `Hello ${name},\n\nThank you for registering at Backend Ledger. We're excited to have you on board!\n\nBest regards,\nThe Backend Ledger Team`;
    const html = `<p>Hello ${name},</p><p> Thank you for registering at Backend Ledger. We're excited to have you on board!</p><p>Best regards,<br>The Backend Ledger Team</p>`;

    await sendEmail(userEmail,subject,text,html)
}

async function sendTransactionEmail(userEmail,name,amount,toAccount){
  const subject = "Transaction successful!";
  const text = `Hello ${name},\n\nYour transaction of ${amount} to account ${toAccount} was successful.\n\n Best regards, \nThe Backend Ledger Team`;
  const html = `<p>Hello ${name},</p><p>Your transaction of ${amount} to account ${toAccount} was successful.</p><p>Best regards,<br>The Backend Ledger Team</p>`;

  await sendEmail(userEmail,subject,text,html)
}

async function sendTransactionFailureEmail(userEmail,name,amount,toAccount){
  const subject = "Transaction failed!";
  const text = `Hello ${name},\n\nWe regret to inform you that your transaction of ${amount} to account ${toAccount} could not be completed.\n\n Best regards, \nThe Backend Ledger Team`;
  const html = `<p>Hello ${name},</p><p>We regret to inform you that your transaction of ${amount} to account ${toAccount} could not be completed.</p><p>Best regards,<br>The Backend Ledger Team</p>`;

  await sendEmail(userEmail,subject,text,html)
}

async function sendTransactionReverseEmail(userEmail,name,amount,toAccount){
  const subject = "Transaction reversed";
  const text = `Hello ${name},\n\nYour transaction of ${amount} to account ${toAccount} has been successfully reversed.\n\n Best regards, \nThe Backend Ledger Team`;
  const html = `<p>Hello ${name},</p><p>Your transaction of ${amount} to account ${toAccount} has been successfully reversed.</p><p>Best regards,<br>The Backend Ledger Team</p>`;

  await sendEmail(userEmail,subject,text,html)
}

module.exports = {
    sendRegistrationEmail,
    sendTransactionEmail,
    sendTransactionFailureEmail,
    sendTransactionReverseEmail
};