import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import * as AWS from "aws-sdk";
import { generateRandomString } from "../../utils/generateRandomString";
import * as jwt from "jsonwebtoken";

const sqs = new AWS.SQS({ region: "us-east-1" });

export const handler = async (event: APIGatewayEvent) => {
  const { email } = JSON.parse(event.body || "");
  const database = new Database();

  try {
    if (!email) {
      console.error("AUTH FORGOTPASSWORD ERROR: E-mail é obrigatório.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "E-mail é obrigatório.",
        }),
      };
    }

    const recoveryCode = generateRandomString(20);

    const user = await database.client.user.findUnique({
      where: { login: email },
      include: { profile: true },
    });

    if (!user) {
      console.error("AUTH FORGOTPASSWORD ERROR: Usuário incorreto.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Usuário incorreto.",
        }),
      };
    }

    await database.client.user.update({
      where: { uid: user?.uid },
      data: {
        recoveryCode,
      },
    });

    const token = jwt.sign(
      {
        uid: user?.uid,
        code: recoveryCode,
      },
      process.env.JWT_SECRET || "",
      {
        expiresIn: "30m",
      }
    );

    const payload = JSON.stringify({
      name: user?.profile?.name,
      source: "contato@alldohost.com.br",
      subject: "Solicitação de Troca de Senha Alldo Assistente",
      ToAddresses: [email],
      link_email: `https://assistente.alldohost.com.br/recovery-password/${token}`,
      htmlTemplate: "forgot-password.html",
    });

    const queueParams: AWS.SQS.SendMessageRequest = {
      MessageBody: payload,
      MessageDeduplicationId: generateRandomString(20),
      QueueUrl: process.env.SEND_EMAIL_QUEUE_URL!,
      MessageGroupId: "SEND_EMAIL",
    };

    try {
      const queueResult = await sqs.sendMessage(queueParams).promise();
      console.log(
        "AUTH FORGOTPASSWORD SUCCESS: Mensagem enviada para SQS de recuperação de senha.",
        queueResult
      );
    } catch (error) {
      console.error(
        "AUTH FORGOTPASSWORD ERROR: Erro ao enviar mensagem para SQS de recuperação de senha.",
        error
      );
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          msg: "Erro interno do servidor.",
          error: error.message,
        }),
      };
    }

    console.log(
      "AUTH FORGOTPASSWORD SUCCESS: E-mail de recuperação de senha enviado com sucesso."
    );
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "E-mail de recuperação de senha enviado com sucesso.",
      }),
    };
  } catch (error) {
    console.error(
      "AUTH FORGOTPASSWORD ERROR: Erro interno do servidor.",
      error
    );
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Erro interno do servidor.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
