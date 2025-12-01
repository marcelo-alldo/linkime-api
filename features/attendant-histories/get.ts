import { APIGatewayEvent } from "aws-lambda";
import Database from "../../database";
import { auth } from "../middlewares/auth.middleware";

export const handler = async (event: APIGatewayEvent) => {
  const database = new Database();
  const authorization = (await auth(event)) as { success: boolean; data: any };

  console.log("AUTHORIZATION", authorization);

  try {
    if (!authorization) {
      console.error(
        "ATTENDANT GET ERROR: Cabeçalho de autorização ausente ou inválido."
      );
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

    // Pagination from queryStringParameters
    const page = event.queryStringParameters?.page
      ? parseInt(event.queryStringParameters.page, 10)
      : 1;
    const pageSize = event.queryStringParameters?.pageSize
      ? parseInt(event.queryStringParameters.pageSize, 10)
      : 100;
    const skip = (page - 1) * pageSize;
    const take = pageSize;
    console.log(
      `Pagination - page: ${page}, paeSize: ${pageSize}, skip: ${skip}, take: ${take}`
    );

    const { remoteJid, getCollaboratorStats, startDate, endDate, last15Days, last30Days } =
      event.queryStringParameters || {};

    console.log("REMOTE JID:", remoteJid);
    console.log("GET COLLABORATOR STATS:", getCollaboratorStats);
    console.log("DATE FILTERS:", { startDate, endDate, last15Days, last30Days });

    // Se for solicitado estatísticas dos colaboradores
    if (getCollaboratorStats === "true") {
      console.log("Buscando estatísticas dos colaboradores...");

      // Calcular filtros de data
      let dateFilter: any = {};
      
      if (last15Days === "true") {
        const fifteenDaysAgo = new Date();
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
        dateFilter.createdAt = {
          gte: fifteenDaysAgo,
        };
      } else if (last30Days === "true") {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        dateFilter.createdAt = {
          gte: thirtyDaysAgo,
        };
      } else if (startDate && endDate) {
        dateFilter.createdAt = {
          gte: new Date(startDate),
          lte: new Date(endDate),
        };
      } else if (startDate) {
        dateFilter.createdAt = {
          gte: new Date(startDate),
        };
      } else if (endDate) {
        dateFilter.createdAt = {
          lte: new Date(endDate),
        };
      }

      console.log("Date filter applied:", dateFilter);

      // Buscar todos os colaboradores do usuário master
      const collaborators = await database.client.collaborator.findMany({
        where: { parentUid: authorization.data.masterUid },
        include: {
          user: {
            select: {
              uid: true,
              profile: { select: { name: true } },
            },
          },
        },
      });

      console.log("Colaboradores encontrados:", collaborators.length);

      // Buscar estatísticas para cada colaborador
      const collaboratorStats = await Promise.all(
        collaborators.map(async (collaborator) => {
          const userUid = collaborator.user.uid;

          // 1. Atendimentos em progresso
          // Buscar atendimentos IN_PROGRESS que não tenham um atendimento FINALIZED mais recente para o mesmo remotejid
          const inProgressAttendances = await database.client.attendantHistory.findMany({
            where: {
              userUid: userUid,
              status: "IN_PROGRESS",
              ...dateFilter,
            },
            select: {
              uid: true,
              remoteJid: true,
              createdAt: true,
            },
          });

          // Filtrar atendimentos que não têm um atendimento finalizado mais recente
          const validInProgressAttendances = await Promise.all(
            inProgressAttendances.map(async (attendance) => {
              const finalizedAttendance = await database.client.attendantHistory.findFirst({
                where: {
                  remoteJid: attendance.remoteJid,
                  status: "FINALIZED",
                  createdAt: {
                    gt: attendance.createdAt,
                  },
                },
                select: {
                  uid: true,
                },
              });

              // Se não existe atendimento finalizado mais recente, este atendimento é válido
              return !finalizedAttendance;
            })
          );

          const inProgressCount = validInProgressAttendances.filter(Boolean).length;

          // 2. Atendimentos finalizados
          const finalizedCount = await database.client.attendantHistory.count({
            where: {
              userUid: userUid,
              status: "FINALIZED",
              ...dateFilter,
            },
          });

          // 3. Conversões para clientes
          const convertedCount = await database.client.attendantHistory.count({
            where: {
              userUid: userUid,
              status: "CONVERTED",
              ...dateFilter,
            },
          });

          // 4. Atendimentos atuais (leads e clients com ownerUid)
          // Ajustar o filtro de data para leads e clients (que podem ter campos de data diferentes)
          let leadDateFilter: any = {};
          let clientDateFilter: any = {};
          
          if (dateFilter.createdAt) {
            // Para leads, usar o campo de data apropriado (assumindo que seja 'createdAt')
            leadDateFilter.createdAt = dateFilter.createdAt;
            // Para clients, usar o campo de data apropriado (assumindo que seja 'createdAt')
            clientDateFilter.createdAt = dateFilter.createdAt;
          }

          const [currentLeads, currentClients] = await Promise.all([
            database.client.lead.count({
              where: {
                ownerUid: userUid,
                ...leadDateFilter,
              },
            }),
            database.client.client.count({
              where: {
                ownerUid: userUid,
                ...clientDateFilter,
              },
            }),
          ]);

          const currentAttendances = currentLeads + currentClients;

          return {
            collaboratorUid: userUid,
            collaboratorName: collaborator.user.profile?.name || "Desconhecido",
            inProgressAttendances: inProgressCount,
            finalizedAttendances: finalizedCount,
            convertedAttendances: convertedCount,
            currentAttendances: currentAttendances,
          };
        })
      );

      console.log("Estatísticas dos colaboradores:", collaboratorStats);

      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          data: collaboratorStats,
          msg: "Estatísticas dos colaboradores recuperadas com sucesso.",
        }),
      };
    }

    // Construindo o filtro de pesquisa corretamente
    const where: any = {};
    // Usar masterUid para filtrar pelo usuário proprietário
    where.masterUid = authorization.data.masterUid;

    // Só adicionar remoteJid ao filtro se ele existir
    if (remoteJid) {
      where.remoteJid = remoteJid;
    }

    console.log("WHERE FILTER:", where);

    const [data, total] = await Promise.all([
      database.client.attendantHistory.findMany({
        where,
        skip,
        take,
        orderBy: { timestamp: "desc" },
        include: {
          user: { select: { profile: { select: { name: true } } } },
          userTransfered: { select: { profile: { select: { name: true } } } },
        },
      }),
      database.client.attendantHistory.count({
        where,
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);
    // LOG: Total pages
    console.log("Total pages:", totalPages);
    console.log("DATA", data);

    const dataSanitized = data
      .sort((a, b) => Number(a.timestamp) - Number(b.timestamp))
      .map((item) => ({
        ...item,
        type: "attendantHistory",
        name: item.user?.profile?.name || "Desconhecido",
        timestamp: item.timestamp?.toString(), // converte BigInt para string
      }));

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        data: dataSanitized,
        total,
        page,
        pageSize,
        totalPages,
        msg: "Históricos de atendimentos recuperados com sucesso.",
      }),
    };
  } catch (error) {
    // LOG: Full error
    console.error("Full error:", error);
    console.error(
      "ATTENDANT GET ERROR: Falha ao recuperar atendimentos.",
      error
    );
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        msg: "Falha ao recuperar atendimentos. Por favor, tente novamente mais tarde.",
      }),
    };
  } finally {
    await database.disconnect();
  }
};
