import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import axios from "axios";
import { subscription } from "../middlewares/subscription.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const subscriptionMiddleware = (await subscription(
    authorization.data.masterUid
  )) as {
    success: boolean;
  };

  console.log("BODY:", event.body);
  const { code, data } = JSON.parse(event.body || "");

  console.log("FACEBOOK AUTH START: Iniciando autenticação do Facebook.");

  try {
    if (!authorization) {
      console.error(
        "FACEBOOK AUTH ERROR: Cabeçalho de autorização ausente ou inválido."
      );
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: token de autorização ausente ou inválido.",
        }),
      };
    }

    if (!subscriptionMiddleware.success) {
      console.error("FACEBOOK AUTH ERROR: Assinatura inválida ou expirada.");
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }

    const user = await database.client.user.findUnique({
      where: {
        uid: authorization.data.masterUid,
      },
      select: {
        profile: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!user || !user.profile || !user.profile.email) {
      console.error("FACEBOOK AUTH ERROR: Usuário não encontrado.");
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Usuário não encontrado.",
        }),
      };
    }

    const appId = process.env.WHATSAPP_APP_ID;
    const appSecret = process.env.WHATSAPP_APP_SECRET;

    //REGISTRA O APP NO FACEBOOK
    const urlSub = `https://graph.facebook.com/v22.0/${data.waba_id}/subscribed_apps`;
    const responseSub = await fetch(urlSub, {
      method: "POST",
      body: JSON.stringify({
        access_token: process.env.WHATSAPP_TOKEN,
      }),
      headers: { "Content-Type": "application/json" },
    });
    const dataSub = await responseSub.json();
    console.log("SUBSCRIBE APP RESPONSE", dataSub);

    //PEGA NUMERO DE TELEFONE
    const urlNumber =
      `https://graph.facebook.com/v22.0/${data.waba_id}/phone_numbers` +
      `?fields=id,cc,country_dial_code,display_phone_number,verified_name,status,quality_rating,search_visibility,platform_type,code_verification_status` +
      `&access_token=${process.env.WHATSAPP_TOKEN}`;
    const response = await fetch(urlNumber, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const dataNumber = await response.json();
    console.log("Phone number data received:", dataNumber);
    const numberInfo = dataNumber.data.find(
      (n) => n.id === data.phone_number_id
    );

    if (!numberInfo) {
      console.error("FACEBOOK AUTH ERROR: Número de telefone não encontrado.");
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          msg: "Número de telefone não encontrado.",
        }),
      };
    }

    if (numberInfo.status === "PENDING") {
      // 2. Troca o code por access_token
      const urlToken = "https://graph.facebook.com/v22.0/oauth/access_token";
      const tokenRes = await fetch(urlToken, {
        method: "POST",
        body: JSON.stringify({
          client_id: appId,
          client_secret: appSecret,
          code: code,
          grant_type: "authorization_code",
          redirect_uri: "",
        }),
        headers: { "Content-Type": "application/json" },
      });

      const tokenData = await tokenRes.json();

      console.log("Token data received:", tokenData);

      const url = `https://graph.facebook.com/v23.0/${numberInfo.id}/register`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          pin: "000000",
        }),
      });

      const data = await response.json();
      console.log("REGISTER PHONE RESPONSE", data);
    }

    const configs = await database.client.userConfig.findMany({
      where: {
        userUid: authorization.data.masterUid,
        key: {
          in: [
            "WHATSAPP-PHONE-ID",
            "WHATSAPP-BUSINESS-ID",
            "WHATSAPP",
            "WHATSAPP-ACCOUNT-ID",
          ],
        },
      },
    });

    if (configs.length > 0) {
      const businessUid =
        configs.find((c) => c.key === "WHATSAPP-BUSINESS-ID")?.uid || "";
      if (businessUid) {
        await database.client.userConfig.update({
          where: { uid: businessUid },
          data: { value: data.business_id },
        });
      }

      const phoneUid =
        configs.find((c) => c.key === "WHATSAPP-PHONE-ID")?.uid || "";
      if (phoneUid) {
        await database.client.userConfig.update({
          where: { uid: phoneUid },
          data: { value: data.phone_number_id },
        });
      }

      const whatsappUid = configs.find((c) => c.key === "WHATSAPP")?.uid || "";
      if (whatsappUid && numberInfo) {
        await database.client.userConfig.update({
          where: { uid: whatsappUid },
          data: { value: numberInfo.display_phone_number },
        });
      }

      const whatsappAccount =
        configs.find((c) => c.key === "WHATSAPP-ACCOUNT-ID")?.uid || "";
      if (whatsappAccount) {
        await database.client.userConfig.update({
          where: { uid: whatsappAccount },
          data: { value: data.waba_id },
        });
      }
    } else {
      await database.client.userConfig.create({
        data: {
          userUid: authorization.data.masterUid,
          key: "WHATSAPP-PHONE-ID",
          value: data.phone_number_id,
          name: "WhatsApp Phone ID",
        },
      });

      await database.client.userConfig.create({
        data: {
          userUid: authorization.data.masterUid,
          key: "WHATSAPP-BUSINESS-ID",
          value: data.business_id,
          name: "WhatsApp Business ID",
        },
      });

      await database.client.userConfig.create({
        data: {
          userUid: authorization.data.masterUid,
          key: "WHATSAPP",
          value: numberInfo ? numberInfo.display_phone_number : "",
          name: "WhatsApp number",
        },
      });

      await database.client.userConfig.create({
        data: {
          userUid: authorization.data.masterUid,
          key: "WHATSAPP-ACCOUNT-ID",
          value: data.waba_id,
          name: "WhatsApp Account Id",
        },
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "Instância conectada com sucesso.",
      }),
    };
  } catch (error) {
    console.error("FACEBOOK AUTH ERROR: Falha ao conectar instância.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao conectar instância. Tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
