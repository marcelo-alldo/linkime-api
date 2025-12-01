import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import { subscription } from "../middlewares/subscription.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();

  try {
    const authorization = (await auth(event)) as { success: boolean; data: any };
    if (!authorization?.success) {
      console.error("TAG CREATE ERROR: Não autorizado: token de autenticação ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: token de autenticação ausente ou inválido.",
        }),
      };
    }

    const subscriptionMiddleware = (await subscription(authorization.data.masterUid)) as {
      success: boolean;
    };
    if (!subscriptionMiddleware.success) {
      console.error("TAG CREATE ERROR: Assinatura inválida ou expirada.");
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }

    const { name, color } = JSON.parse(event.body || "{}");

    if (!name || !color) {
      console.error("TAG CREATE ERROR: Campos obrigatórios não informados (nome e cor da tag).");
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Campos obrigatórios não informados (nome e cor da tag).",
        }),
      };
    }

    // Validar formato da cor (hex)
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!hexColorRegex.test(color)) {
      console.error("TAG CREATE ERROR: Formato de cor inválido. Use formato hexadecimal (#RRGGBB).");
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Formato de cor inválido. Use formato hexadecimal (#RRGGBB).",
        }),
      };
    }

    // Verificar se já existe uma tag com o mesmo nome para o usuário
    const existingTag = await database.client.tag.findFirst({
      where: {
        name,
        userUid: authorization.data.masterUid
      },
    });

    if (existingTag) {
      console.error("TAG CREATE ERROR: Já existe uma tag com este nome.");
      return {
        statusCode: 409,
        body: JSON.stringify({
          success: false,
          msg: "Já existe uma tag com este nome.",
        }),
      };
    }

    const newTag = await database.client.tag.create({
      data: {
        name,
        color,
        userUid: authorization.data.masterUid,
      },
    });

    console.log("TAG CREATE SUCCESS: Tag criada com sucesso.");
    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        msg: "Tag criada com sucesso.",
        data: newTag,
      }),
    };
  } catch (error) {
    console.error("TAG CREATE ERROR: Falha ao criar tag.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao criar tag. Tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};