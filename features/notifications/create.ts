import { APIGatewayEvent } from "aws-lambda";
import * as admin from "firebase-admin";
import { auth } from "../middlewares/auth.middleware";
import { SecretsManager } from "aws-sdk";

export const handler = async (event: APIGatewayEvent) => {
  const { title, body, token } = JSON.parse(event.body || "");
  const authorization = (await auth(event)) as { success: boolean; data: any };

  //KEY FIREBASE
  const secretsManager = new SecretsManager();
  const secret = await secretsManager
    .getSecretValue({ SecretId: "firebase-key" })
    .promise();
  const firebaseConfig = JSON.parse(secret.SecretString!);

  // Inicializar o Firebase Admin SDK
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: firebaseConfig,
      }),
    });
  }

  try {
    if (!authorization) {
      console.error(
        "NOTIFICATIONS CREATE ERROR: Cabeçalho de autorização ausente ou inválido."
      );
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    if (!title || !body || !token) {
      console.error(
        "NOTIFICATIONS CREATE ERROR: Campos obrigatórios não informados (title, body, token)."
      );
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Campos obrigatórios não informados: title, body ou token.",
        }),
      };
    }

    // Enviar notificação via Firebase Cloud Messaging
    const message = {
      notification: {
        title,
        body,
      },
      token,
    };

    console.log("Sending push notification:", message);

    const response = await admin.messaging().send(message);

    console.log("Push notification response:", response);
    console.log(
      "NOTIFICATIONS CREATE SUCCESS: Notificação enviada com sucesso.",
      response
    );
    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        msg: "Notificação enviada com sucesso.",
        response,
      }),
    };
  } catch (error) {
    console.error(
      "NOTIFICATIONS CREATE ERROR: Falha ao enviar notificação.",
      error
    );
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao enviar notificação.",
        error: error.message,
      }),
    };
  }
};
