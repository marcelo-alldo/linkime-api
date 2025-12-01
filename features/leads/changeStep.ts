import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";
import { subscription } from "../middlewares/subscription.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };
  const { uid } = event.pathParameters || {};
  const { stepUid, position, stepName } = JSON.parse(event.body || "");
  const subscriptionMiddleware = (await subscription(
    authorization.data.masterUid
  )) as {
    success: boolean;
  };

  try {
    if (!authorization) {
      console.error(
        "LEAD CHANGE STEP ERROR: Cabeçalho de autorização ausente ou inválido."
      );
      return {
        statusCode: 401,
        body: JSON.stringify({
          success: false,
          msg: "Não autorizado: Cabeçalho de autorização ausente ou inválido.",
        }),
      };
    }

    if (!subscriptionMiddleware.success) {
      console.error("LEAD CHANGE STEP ERROR: Assinatura inválida ou expirada.");
      return {
        statusCode: 403,
        body: JSON.stringify({
          success: false,
          msg: "Assinatura inválida ou expirada.",
        }),
      };
    }

    // LOG: Received parameters
    console.log(
      "Received stepUid:",
      stepUid,
      "position:",
      position,
      "uid:",
      uid,
      "stepName:",
      stepName
    );

    // Resolve stepName to stepUid if needed
    let targetStepUid = stepUid;
    if (!targetStepUid && stepName) {
      const targetStep = await database.client.step.findFirst({
        where: {
          name: stepName,
          stepType: "LEAD",
          OR: [{ userUid: null }, { userUid: authorization.data.masterUid }],
        },
        select: { uid: true },
      });

      if (!targetStep) {
        console.error("LEAD CHANGE STEP ERROR: Etapa não encontrada pelo nome.");
        return {
          statusCode: 404,
          body: JSON.stringify({
            success: false,
            msg: "Etapa não encontrada pelo nome informado.",
          }),
        };
      }

      targetStepUid = targetStep.uid;
    }

    // Fetch current lead to get origin step and old position
    const currentLead = await database.client.lead.findUnique({
      where: { uid },
      select: { stepUid: true, position: true },
    });

    // LOG: Current lead info
    console.log("Current lead:", currentLead);

    if (targetStepUid === process.env.START_CONVERSATION_UID) {
      const countLeadsOnStartConversation = await database.client.lead.count({
        where: {
          userUid: authorization.data.masterUid,
          stepUid: process.env.START_CONVERSATION_UID,
        },
      });

      if (countLeadsOnStartConversation >= 50) {
        console.error(
          "LEAD CHANGE STEP ERROR: Limite de 50 leads na etapa de Iníciar Conversa com Alldo atingido."
        );
        return {
          statusCode: 403,
          body: JSON.stringify({
            success: false,
            msg: "Limite de 50 leads na etapa de Conversa com Alldo atingido.",
          }),
        };
      }
    }

    if (!currentLead) {
      console.error("LEAD CHANGE STEP ERROR: Lead não encontrado.");
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          msg: "Lead não encontrado.",
        }),
      };
    }

    // LOG: Iniciando transação para atualizar posições e lead
    const updatedLead = await database.client.$transaction(async (prisma) => {
      // LOG: Updating positions in origin step
      console.log("Updating origin step positions:", {
        stepUid: currentLead.stepUid,
        position: { gt: currentLead.position },
      });
      await prisma.lead.updateMany({
        where: {
          stepUid: currentLead.stepUid,
          position: { gt: currentLead.position },
        },
        data: {
          position: { decrement: 1 },
        },
      });

      // LOG: Updating positions in destination step
      console.log("Updating destination step positions:", {
        stepUid: targetStepUid,
        position: { gte: position },
      });
      await prisma.lead.updateMany({
        where: {
          stepUid: targetStepUid,
          position: { gte: position },
        },
        data: {
          position: { increment: 1 },
        },
      });

      // LOG: Updating lead to new step and position
      console.log("Updating lead:", { uid, position, stepUid: targetStepUid });
      return await prisma.lead.update({
        where: { uid },
        data: {
          position,
          step: {
            connect: { uid: targetStepUid },
          },
        },
      });
    });

    // LOG: Updated lead result
    console.log("Updated lead:", updatedLead);

    switch (targetStepUid) {
      case process.env.START_CONVERSATION_UID:
        // if (currentLead.stepUid !== process.env.START_CONVERSATION_UID) {
        //   // Usa o horário de Brasília (America/Sao_Paulo)
        //   const timeZone = "America/Sao_Paulo";
        //   const now = toZonedTime(new Date(), timeZone);
        //   const hour = now.getHours();
        //   let message = "Olá";
        //   if (hour >= 5 && hour < 12) message = "Olá bom dia";
        //   else if (hour >= 12 && hour < 18) message = "Olá boa tarde";
        //   else message = "Olá boa noite";
        //   const fullMessage = `${message}, tudo bem?`;

        //   // Remove (), espaço e - do número e adiciona DDI 55 se não tiver
        //   let number = updatedLead.phone.replace(/[()\s-]/g, "");
        //   if (!number.startsWith("55")) {
        //     number = "55" + number;
        //   }

        //   console.log("Número com o nono dígito:", number);

        //   const user = await database.client.user.findUnique({
        //     where: { uid: authorization.data.masterUid },
        //     select: { profile: { select: { email: true } } },
        //   });

        //   await database.client.lead.update({
        //     where: { uid },
        //     data: {
        //       conversation: "working",
        //     },
        //   });

        //   // LOG: Verificando valor do header Authorization
        //   console.log(
        //     "Authorization header:",
        //     process.env.ALLDO_ASSISTENTE_APIKEY ? "[DEFINED]" : "[UNDEFINED]"
        //   );
        //   try {
        //     await axios.post(
        //       `${process.env.ALLDO_ASSISTENTE_BASE_URL}/message/sendText/${user?.profile?.email}`,
        //       {
        //         number,
        //         text: fullMessage,
        //       },
        //       {
        //         headers: {
        //           apikey: `${process.env.ALLDO_ASSISTENTE_APIKEY}`,
        //         },
        //       }
        //     );
        //   } catch (e) {
        //     try {
        //       let newNumber = number;
        //       const match = number.match(/^(55)(\d{2})9(\d{8})$/);
        //       if (match) {
        //         newNumber = match[1] + match[2] + match[3];
        //       }
        //       console.log("Número sem o nono dígito:", newNumber);

        //       await axios.post(
        //         `${process.env.ALLDO_ASSISTENTE_BASE_URL}/message/sendText/${user?.profile?.email}`,
        //         {
        //           number: newNumber,
        //           text: fullMessage,
        //         },
        //         {
        //           headers: {
        //             apikey: `${process.env.ALLDO_ASSISTENTE_APIKEY}`,
        //           },
        //         }
        //       );
        //     } catch (error) {
        //       if (e.response && e.response.data) {
        //         // Serializa objetos aninhados para melhor visualização no log
        //         const safeData = JSON.stringify(e.response.data, null, 2);
        //         const safeHeaders = JSON.stringify(e.response.headers, null, 2);
        //         console.error(
        //           "Erro ao enviar mensagem para Evolution sem o nono digito:",
        //           {
        //             status: e.response.status,
        //             data: safeData,
        //             headers: safeHeaders,
        //           }
        //         );
        //       } else {
        //         console.error(
        //           "Erro ao enviar mensagem para Evolution sem o nono digito:",
        //           e
        //         );
        //       }
        //       await database.client.lead.update({
        //         where: { uid },
        //         data: {
        //           conversation: "not_working",
        //         },
        //       });
        //     }
        //     if (e.response && e.response.data) {
        //       // Serializa objetos aninhados para melhor visualização no log
        //       const safeData = JSON.stringify(e.response.data, null, 2);
        //       const safeHeaders = JSON.stringify(e.response.headers, null, 2);
        //       console.error(
        //         "Erro ao enviar mensagem para Evolution com o nono digito:",
        //         {
        //           status: e.response.status,
        //           data: safeData,
        //           headers: safeHeaders,
        //         }
        //       );
        //     } else {
        //       console.error(
        //         "Erro ao enviar mensagem para Evolution com o nono digito:",
        //         e
        //       );
        //     }
        //   }
        // } else {
        //   console.log(
        //     "LEAD CHANGE STEP INFO: Lead já está na etapa de Iniciar Conversa com Alldo."
        //   );
        // }

        console.log(
          "LEAD CHANGE STEP INFO: Lead já está na etapa de Iniciar Conversa com Alldo."
        );

        break;

      case process.env.LAST_STEP_UID:
        // LOG: Atualizando lead para cliente
        console.log("Updating lead to client status:", updatedLead.uid);

        // Envolvendo exclusão do lead e criação do client em uma transação
        const result = await database.client.$transaction(async (prisma) => {
          const deletedLead = await prisma.lead.delete({
            where: { uid: updatedLead.uid },
          });

          const lastClient = await prisma.client.findFirst({
            where: {
              userUid: authorization.data.masterUid,
              stepUid: process.env.FIRST_STEP_CLIENT_UID,
            },
            orderBy: {
              position: "desc",
            },
            select: {
              position: true,
            },
          });

          const nextPosition = lastClient?.position
            ? lastClient.position + 1
            : 1;

          const createdClient = await prisma.client.create({
            data: {
              user: {
                connect: { uid: authorization.data.masterUid },
              },
              clientProfile: {
                create: {
                  cpf: deletedLead.cpf,
                  email: deletedLead.email,
                  name: deletedLead.name,
                  phone: deletedLead.phone,
                  notes: deletedLead.notes,
                  summary: deletedLead.summary,
                },
              },
              step: {
                connect: {
                  uid: process.env.FIRST_STEP_CLIENT_UID,
                },
              },
              position: nextPosition,
            },
          });

          return { deletedLead, createdClient };
        });
        console.log(
          "LEAD CHANGE STEP SUCCESS: Lead convertido em cliente com sucesso.",
          result
        );
        break;
    }

    console.log(
      "LEAD CHANGE STEP SUCCESS: Lead atualizado com sucesso.",
      updatedLead
    );
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: updatedLead,
        msg: "Lead atualizado com sucesso.",
      }),
    };
  } catch (error) {
    console.error("LEAD CHANGE STEP ERROR: Falha ao atualizar lead.", error);
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
