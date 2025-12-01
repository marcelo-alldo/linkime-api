import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import { subscription } from "../middlewares/subscription.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const subscriptionMiddleware = (await subscription(authorization.data.masterUid)) as {
    success: boolean;
  };
  // Parse all possible fields from body
  const { enable, email, name, phone, cpf, birthDate } = JSON.parse(event.body || "{}");
  const { uid } = event.pathParameters || {};
  // LOG: Received parameters
  console.log("Received parameters:", {
    enable,
    email,
    name,
    phone,
    cpf,
    birthDate,
  });

  try {
    if (!authorization) {
      console.error("COLLABORATOR UPDATE ERROR: Cabeçalho de autorização ausente ou inválido.");
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    if (!subscriptionMiddleware.success) {
      console.error("COLLABORATOR UPDATE ERROR: Assinatura inválida ou expirada.");
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }

    if (!uid) {
      console.error("COLLABORATOR UPDATE ERROR: Campo obrigatório não informado (uid).");
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          msg: "Requisição inválida: Campo obrigatório não informado (uid).",
        }),
      };
    }

    // LOG: Updating collaborator profile with uid
    console.log("Updating collaborator with uid:", uid);

    // Find the collaborator
    const collaborator = await database.client.collaborator.findUnique({
      where: { uid },
      select: { uid: true, userUid: true, enable: true },
    });
    if (!collaborator) {
      console.error("COLLABORATOR UPDATE ERROR: Colaborador não encontrado.");
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          msg: "Colaborador não encontrado.",
        }),
      };
    }

    // Update the Collaborator ENABLE
    if (typeof enable === "boolean") {
      // LOG: Toggling enable for collaborator with uid
      console.log("Toggling enable for collaborator with uid:", uid);
      // Get current value
      const updatedCollaborator = await database.client.collaborator.update({
        where: { uid },
        data: {
          enable: !collaborator.enable,
          user: {
            update: {
              enable: !collaborator.enable,
            },
          },
        },
      });
      // LOG: Collaborator enable toggled
      console.log(
        "COLLABORATOR UPDATE SUCCESS: Status de enable do colaborador alterado com sucesso.",
        updatedCollaborator
      );
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          msg: "Status de enable do colaborador alterado com sucesso.",
          data: updatedCollaborator,
        }),
      };
    }

    // Atualiza o DataProfile do user relacionado
    const updatedUser = await database.client.user.update({
      where: { uid: collaborator.userUid },
      data: {
        profile: {
          update: {
            email,
            name,
            phone,
            cpf,
            birthDate: birthDate ? new Date(birthDate) : null,
          },
        },
      },
      include: { profile: true },
    });
    console.log("COLLABORATOR UPDATE SUCCESS: Perfil do colaborador atualizado com sucesso.", updatedUser.profile);

    console.log("COLLABORATOR UPDATE SUCCESS: Colaborador atualizado com sucesso.");
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        msg: "Colaborador atualizado com sucesso.",
      }),
    };
  } catch (error) {
    // LOG: Full error
    console.error("COLLABORATOR UPDATE ERROR: Falha ao atualizar colaborador.", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao atualizar colaborador. Por favor, tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
