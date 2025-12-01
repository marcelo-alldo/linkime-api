import axios from "axios";
import prisma from "../database/prismaClient";

async function main() {
  // Busca todos os estados do IBGE
  const estadosRes = await axios.get("https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome");
  const estados = estadosRes.data;

  for (const estado of estados) {
    // Cria o estado no banco
    const state = await prisma.state.upsert({
      where: { codeIbge: estado.id },
      update: {},
      create: {
        name: estado.nome,
        codeIbge: estado.id,
        countryUid: "99c7a086-b63a-4ba1-aed6-a6c585d79131",
      },
    });

    console.log(`Estado ${estado.nome} inserido.`);

    // Busca cidades do estado
    const cidadesRes = await axios.get(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${estado.id}/municipios`
    );
    const cidades = cidadesRes.data;
    for (const cidade of cidades) {
      await prisma.city.upsert({
        where: { codeIbge: cidade.id },
        update: {},
        create: {
          name: cidade.nome,
          codeIbge: cidade.id,
          state: {
            connect: {
              codeIbge: estado.id,
            },
          },
        },
      });
    }
    console.log(`Estado ${estado.nome} e suas cidades inseridos.`);
  }
  console.log("População de estados e cidades finalizada!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
