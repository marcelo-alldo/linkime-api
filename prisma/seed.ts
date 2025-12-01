import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction([
    prisma.role.create({
      data: {
        uid: "1a40a243-ea17-4df8-9765-cb1af641f574",
        name: "user",
        description: "User role",
        type: 1,
        roleFeatures: {
          create: {
            uid: "aed35a31-a338-4912-a786-39df22fae3e8",
            actions: {
              create: false,
              read: true,
              delete: false,
              update: false,
            },
            feature: {
              create: {
                uid: "ef7c1dcc-8483-43e7-bb26-74f036ec8bb8",
                name: "User feature",
                description: "User feature",
                endpoint: "/scrumboard",
              },
            },
          },
        },
      },
    }),

    prisma.role.create({
      data: {
        uid: "654dc54c-890a-47f0-94c0-b8dbf7022e86",
        name: "admin",
        description: "Admin role",
        type: 2,
        roleFeatures: {
          create: {
            uid: "ac0154f7-a4a2-41e0-93bb-7c02b90ab57b",
            actions: {
              create: true,
              read: true,
              delete: true,
              update: true,
            },
            feature: {
              create: {
                uid: "61f1f9f6-d830-4bf1-bf06-ec2cbb6851fb",
                name: "Admin feature",
                description: "Admin feature",
                endpoint: "/admin/dashboard",
              },
            },
          },
        },
      },
    }),

    prisma.role.create({
      data: {
        uid: "ce30ee3e-d22d-4f4f-b517-d70d2d0d5baa",
        name: "collabolator",
        description: "Collabolator role",
        type: 2,
        roleFeatures: {
          create: {
            uid: "4c888708-5396-4efd-9819-2d73127b2f1b",
            actions: {
              create: true,
              read: true,
              delete: true,
              update: true,
            },
            feature: {
              create: {
                uid: "6ca01538-042b-4604-bff5-d11a5007a58b",
                name: "Collabolator feature",
                description: "Collabolator feature",
                endpoint: "/scrumboard",
              },
            },
          },
        },
      },
    }),

    prisma.subscription.create({
      data: {
        uid: "afe8df80-21ca-43ae-9f5b-07fe735a6c47",
        name: "Free Trial",
        description: "Free trial subscription",
        price: 0,
        enable: true,
      },
    }),

    prisma.user.create({
      data: {
        uid: "af69685f-e46e-400b-a296-2569cdd32704",
        login: "user@teste.com",
        password: await bcrypt.hash("123123", 10),
        profile: {
          create: {
            uid: "31e5ad88-45ed-4a88-846e-075fa3006b9a",
            cpf: "444.444.444-44",
            email: "user@teste.com",
            name: "User Teste",
            phone: "(11) 99999-9999",
            address: {
              create: {
                uid: "0bdea3fe-f116-4afc-a70c-16552acd9743",
                address: "Rua Jacob Pilger",
                complement: "Casa",
                latitude: "-29.57755",
                longitude: "-50.90394",
                point: "POINT(-29.57755 -50.90394)",
                neighborhood: "Das Rosas",
                number: "1006",
                zipCode: "93890-000",
                city: {
                  create: {
                    uid: "222b05e2-edbb-4b44-9a3a-bd6018d064e6",
                    name: "Nova Hartz",
                    codeIbge: 4313060,
                    state: {
                      create: {
                        uid: "ed5f2c10-afd1-4d14-872d-3db914ac2252",
                        name: "Rio Grande do Sul",
                        codeIbge: 43,
                        country: {
                          create: {
                            uid: "99c7a086-b63a-4ba1-aed6-a6c585d79131",
                            name: "Brasil",
                            initials: "BR",
                            m49: "076",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        userFeatures: {
          create: {
            uid: "2182aba5-045c-4e56-90b6-543602a31815",
            actions: {
              create: false,
              update: false,
              read: true,
              delete: false,
            },
            featureUid: "ef7c1dcc-8483-43e7-bb26-74f036ec8bb8",
            roleUid: "1a40a243-ea17-4df8-9765-cb1af641f574",
          },
        },
        userRoles: {
          create: {
            uid: "0732c4d5-50ca-4314-aca1-174a1e4f65f3",
            roleUid: "1a40a243-ea17-4df8-9765-cb1af641f574",
          },
        },
      },
    }),

    prisma.user.create({
      data: {
        uid: "639d8b4b-7dd8-4ecd-8277-c9e0178cd329",
        login: "admin@alldo.com",
        password: await bcrypt.hash("123123", 10),

        profile: {
          create: {
            uid: "d9e65e6d-9754-46db-9af4-89dd25985449",
            cpf: "000.000.000-00",
            email: "admin@alldo.com",
            name: "Admin Teste",
            phone: "(00) 00000-0000",
            address: {
              create: {
                uid: "90ba0e5e-d478-4e5f-9236-e0dd8d162718",
                address: "Rua Jacob Pilger",
                complement: "Casa",
                latitude: "-29.57755",
                longitude: "-50.90394",
                point: "POINT(-29.57755 -50.90394)",
                neighborhood: "Das Rosas",
                number: "1006",
                zipCode: "93890-000",
                city: {
                  connect: {
                    uid: "222b05e2-edbb-4b44-9a3a-bd6018d064e6",
                  },
                },
              },
            },
          },
        },
        userFeatures: {
          create: {
            uid: "0c0775ad-fcd7-4488-93a1-8de35f8dbfc2",
            actions: {
              create: false,
              update: false,
              read: true,
              delete: false,
            },
            featureUid: "61f1f9f6-d830-4bf1-bf06-ec2cbb6851fb",
            roleUid: "654dc54c-890a-47f0-94c0-b8dbf7022e86",
          },
        },
        userRoles: {
          create: {
            uid: "fe18582a-7351-41d4-a548-f2534a4f1144",
            roleUid: "654dc54c-890a-47f0-94c0-b8dbf7022e86",
          },
        },
      },
    }),
  ]);
}
main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
