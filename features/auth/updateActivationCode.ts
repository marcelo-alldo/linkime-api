import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { generateRandomString } from "../../utils/generateRandomString";
import * as jwt from "jsonwebtoken";
import * as AWS from "aws-sdk";
import { auth } from "../middlewares/auth.middleware";

const sqs = new AWS.SQS({ region: "us-east-1" });

export const handler = async (event: APIGatewayEvent) => {
  const { token } = event.pathParameters || {};
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const database = new Database();

  if (!token) {
    console.error("AUTH UPDATEACTIVATIONCODE ERROR: Token é obrigatório.");
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        msg: "Token é obrigatório.",
      }),
    };
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || "");
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      decoded = jwt.decode(token);
    } else {
      decoded = authorization.data;
    }
  }

  if (!decoded) {
    console.error("AUTH UPDATEACTIVATIONCODE ERROR: Token inválido.");
    return {
      statusCode: 401,
      body: JSON.stringify({
        success: false,
        msg: "Token inválido.",
      }),
    };
  }

  const { uid } = decoded as { uid: string };

  try {
    const user = await database.client.user.findUnique({
      where: { uid },
      include: { profile: true },
    });

    if (!user) {
      console.error("AUTH UPDATEACTIVATIONCODE ERROR: Usuário incorreto.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Usuário incorreto.",
        }),
      };
    }

    const newActivationCode = generateRandomString(20);

    await database.client.user.update({
      where: { uid },
      data: {
        activationCode: newActivationCode,
        confirmed: false,
      },
    });

    const newToken = jwt.sign(
      {
        uid: user?.uid,
        code: newActivationCode,
      },
      process.env.JWT_SECRET || "",
      {
        expiresIn: "30m",
      }
    );

    const payload = JSON.stringify({
      name: user?.profile?.name,
      source: "contato@alldohost.com.br",
      subject: "Confirmação de E-mail Alldo Assistente",
      ToAddresses: [user?.login],
      link_email: `https://assistente.alldohost.com.br/confirm-account/${newToken}`,
      htmlTemplate: "confirm-account.html",
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
        "AUTH UPDATEACTIVATIONCODE SUCCESS: Mensagem enviada para SQS de confirmação de e-mail.",
        queueResult
      );
    } catch (error) {
      console.error(
        "AUTH UPDATEACTIVATIONCODE ERROR: Erro ao enviar mensagem para SQS de confirmação de e-mail.",
        error
      );
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          msg: "Erro interno do servidor.",
        }),
      };
    }

    console.log(
      "AUTH UPDATEACTIVATIONCODE SUCCESS: Código de ativação atualizado e e-mail enviado com sucesso."
    );
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "Código de ativação atualizado e e-mail enviado com sucesso.",
      }),
    };
  } catch (error) {
    console.error(
      "AUTH UPDATEACTIVATIONCODE ERROR: Erro interno do servidor.",
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
