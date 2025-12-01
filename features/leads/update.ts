import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import { subscription } from "../middlewares/subscription.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const { email, name, phone, cpf, notes } = JSON.parse(event.body || "{}");
  const subscriptionMiddleware = (await subscription(authorization.data.masterUid)) as {
    success: boolean;
  };
  const { uid } = event.pathParameters || {};

  console.log("Received parameters:", { email, name, phone, cpf, uid, notes });

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

    if (!subscriptionMiddleware.success) {
      console.error("LEAD UPDATE ERROR: Assinatura inválida ou expirada.");
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }

    if (!uid) {
      console.error("LEAD UPDATE ERROR: Campo obrigatório não informado (uid).");
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Requisição inválida: Campo obrigatório não informado (uid).",
        }),
      };
    }

    // Only check name and phone if they are provided in the request
    if ((name !== undefined && !name) || (phone !== undefined && !phone)) {
      console.error("LEAD UPDATE ERROR: Campos obrigatórios inválidos (nome ou telefone).");
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Requisição inválida: Campos obrigatórios inválidos (nome ou telefone).",
        }),
      };
    }

    console.log("Updating lead with uid:", uid);

    // Build update data dynamically
    const updateData: any = {};
    if (email !== undefined) updateData.email = email;
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (cpf !== undefined) updateData.cpf = cpf;
    if (notes !== undefined) updateData.notes = notes;

    const updatedLead = await database.client.lead.update({
      where: { uid },
      data: updateData,
    });

    console.log("LEAD UPDATE SUCCESS: Lead atualizado com sucesso.", updatedLead);
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "Lead atualizado com sucesso.",
      }),
    };
  } catch (error) {
    console.error("LEAD UPDATE ERROR: Falha ao atualizar lead.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao atualizar lead. Por favor, tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
