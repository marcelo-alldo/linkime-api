import { SQSEvent } from "aws-lambda";
import * as AWS from "aws-sdk";
import * as nodemailer from "nodemailer";
import * as fs from "fs";
import * as path from "path";
import * as Handlebars from "handlebars";

const ses = new AWS.SES({ region: "us-east-1" });

export const handler = async (event: SQSEvent) => {
  try {
    for (const record of event.Records) {
      const messageBody = JSON.parse(record.body);

      const htmlFilePath = path.join(__dirname, "templates", messageBody?.htmlTemplate);

      const htmlTemplate = fs.readFileSync(htmlFilePath, "utf-8");
      const template = Handlebars.compile(htmlTemplate);
      // Adiciona temporary_password ao contexto do template
      const htmlContent = template({
        link_email: messageBody?.link_email,
        temporary_password: messageBody?.temporary_password,
      });

      const transporter = nodemailer.createTransport({
        SES: ses,
      });

      const mailOptions = {
        from: messageBody?.source,
        to: messageBody?.ToAddresses,
        subject: messageBody?.subject,
        html: htmlContent,
      };

      await transporter.sendMail(mailOptions);
      console.log("Email sent successfully");
    }
  } catch (error) {
    console.error("Error sending email:", error);
  }
};
