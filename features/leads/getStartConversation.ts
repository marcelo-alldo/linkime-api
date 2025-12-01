import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";

function formatPhones(phone: string): string[] {
  // Remove caracteres especiais
  const clean = phone.replace(/[()\-\s]/g, "");
  const ddd = clean.substring(0, 2);
  const rest = clean.substring(2);

  // Se já começa com 9, remove para a versão sem 9
  const restWithoutNine = rest.startsWith("9") ? rest.substring(1) : rest;

  // Com 9 na frente (mantém como está)
  const withNine = `55${ddd}${rest}@s.whatsapp.net`;
  // Sem 9 na frente (remove o primeiro 9)
  const withoutNine = `55${ddd}${restWithoutNine}@s.whatsapp.net`;

  return [withNine, withoutNine];
}

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };

  try {
    if (!authorization) {
      console.error("LEAD GET START CONVERSATION ERROR: Cabeçalho de autorização ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    // LOG: Authenticated user UID
    console.log("Authenticated user UID:", authorization.data.userUid);

    const leads = await database.client.lead.findMany({
      where: {
        userUid: authorization.data.masterUid,
        stepUid: process.env.START_CONVERSATION_UID,
      },
      select: {
        phone: true,
      },
    });

    console.log("Leads found:", leads);

    const dataFormated = leads.flatMap(({ phone }) => formatPhones(phone));

    console.log("LEAD GET START CONVERSATION SUCCESS: Telefones dos leads recuperados com sucesso.", dataFormated);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: dataFormated,
        msg: "Telefones dos leads recuperados com sucesso.",
      }),
    };
  } catch (error) {
    // LOG: Full error
    console.error("LEAD GET START CONVERSATION ERROR: Falha ao recuperar telefones dos leads.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao recuperar telefones dos leads. Por favor, tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
