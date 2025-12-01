import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import { doPost } from "../../sources/alldo-payments/api";

export const handler = async (event: APIGatewayEvent) => {
  const {
    holderName,
    number,
    expiryMonth,
    expiryYear,
    ccv,
    name,
    email,
    cpfCnpj,
    phone,
    postalCode,
    addressNumber,
    addressComplement,
    cardName,
    ip,
  } = JSON.parse(event.body || "");
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const xForwardedFor = ip;

  const database = new Database();

  console.log("X-FORWARDED-FOR", xForwardedFor);

  let response;
  let tokenizedCreditCard;

  try {
    if (!authorization) {
      console.error("CREDIT CARD TOKENIZE ERROR: Cabeçalho de autorização ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    if (!holderName || !number || !expiryMonth || !expiryYear || !ccv) {
      console.error("CREDIT CARD TOKENIZE ERROR: Campos obrigatórios do cartão não informados.");
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          msg: "Campos obrigatórios do cartão não informados.",
        }),
      };
    }

    const user = await database.client.dataProfile.findFirst({
      where: {
        user: {
          uid: authorization?.data?.masterUid,
        },
      },
    });

    if (!user) {
      console.error("CREDIT CARD TOKENIZE ERROR: Usuário não encontrado.");
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          msg: "Usuário não encontrado.",
        }),
      };
    }

    try {
      const data = {
        cpfCnpj: cpfCnpj,
        name: user.name,
        creditCard: {
          holderName,
          number,
          expiryMonth,
          expiryYear,
          ccv,
        },
        creditCardHolderInfo: {
          name: name ? name : user.name,
          email: email ? email : user.email,
          cpfCnpj: cpfCnpj,
          postalCode,
          phone: phone ? phone : user.phone,
          addressNumber,
          addressComplement,
        },
        remoteIp: xForwardedFor,
      };

      response = await doPost("/credit-card/tokenize", data);

      console.log("TOKENIZE CREDIT CARD RESPONSE", response);

      if (response.success !== true) {
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            msg: response?.data?.errors[0]?.description || "Erro ao cadastrar o cartão de crédito.",
          }),
        };
      }

      tokenizedCreditCard = response.data;
    } catch (error) {
      console.log("TOKENIZE CREDIT CARD ERROR", error);
      console.log("TOKENIZE CREDIT CARD RESPONSE ERROR", response);
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          msg: response?.data?.errors[0]?.description || "Erro ao cadastrar o cartão de crédito.",
        }),
      };
    }

    await database.client.userCreditCard.updateMany({
      where: {
        userUid: authorization?.data?.masterUid,
      },
      data: {
        isActive: false,
      },
    });

    await database.client.userCreditCard.create({
      data: {
        creditCardBrand: tokenizedCreditCard.creditCardBrand,
        creditCardToken: tokenizedCreditCard.creditCardToken,
        creditCardNumber: tokenizedCreditCard.creditCardNumber,
        userUid: authorization?.data?.masterUid,
        cardName: cardName ? cardName : holderName,
      },
    });

    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        msg: "Cartão de crédito cadastrado com sucesso.",
      }),
    };
  } catch (error) {
    console.error("CREDIT CARD TOKENIZE ERROR: Erro interno do servidor.", error);
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
