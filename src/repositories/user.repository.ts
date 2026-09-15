import { prisma } from '../config/database.js';

export const findUserByEmail = async (email: string) => {
  return prisma.user.findUnique({
    where: {
      email,
    },
  });
};

export const findUserByEmailGetProfile = async (email: string) => {
  return prisma.user.findUnique({
    where: { email },
    include: { profiles: true },
  });
};



export const createUser = async (data: {
  name: string;
  email: string;
  password: string;
}) => {
  return prisma.user.create({
    data: {        
      name:data.name,
      email: data.email,
      password: data.password,

      profiles: {
        create: {
          currency: 'IDR',
          timezone: 'Asia/Jakarta',
        },
      },
    },
    include: {
      profiles: true,
    },
  });
};

export const findUserById = async (userId: string) => {
  return prisma.user.findUnique({
    where: {
      id: userId,
    },

    include: {
      profiles: true,
    },
  });
};