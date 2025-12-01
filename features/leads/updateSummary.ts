import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import { formatPhoneToDb } from "../../utils/formatPhone";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const { whatsapp, summary } = JSON.parse(event.body || "");
  // LOG: Received parameters
  console.log("Received parameters:", { whatsapp, summary });

  try {
    if (!authorization) {
      console.error("LEAD UPDATE ERROR: Cabeçalho de autorização ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    // Only name and phone are required
    if (!whatsapp || !summary) {
      console.error("LEAD UPDATE ERROR: Campos obrigatórios não informados (whatsapp, summary).");
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Requisição inválida: Campos obrigatórios não informados (whatsapp, summary).",
        }),
      };
    }

    const lead = await database.client.lead.findFirst({
      where: {
        phone: formatPhoneToDb(whatsapp),
        userUid: authorization.data.masterUid,
      },
    });

    if (!lead) {
      console.error("LEAD UPDATE SUMMARY ERROR: Lead não encontrado.");
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          msg: "Lead não encontrado.",
        }),
      };
    }

    // LOG: Updating lead
    console.log("Updating summary lead with uid:", lead.uid);

    const updatedLead = await database.client.lead.update({
      where: { uid: lead.uid },
      data: {
        summary,
      },
    });

    // LOG: Lead updated successfully
    console.log("LEAD UPDATE SUMMARY SUCCESS: Lead resumo atualizado com sucesso.", updatedLead);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "Resumo do Lead atualizado com sucesso.",
      }),
    };
  } catch (error) {
    // LOG: Full error
    console.error("LEAD UPDATE SUMMARY ERROR: Falha ao atualizar o resumo do lead.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao atualizar resumo do lead. Por favor, tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
