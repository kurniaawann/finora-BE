import {
  createUser,
  findUserByEmail,
  findUserByEmailGetProfile,
  findUserById,
} from '../repositories/user.repository.js';
import { generateAccessToken } from '../utils/jwt.js';

import { comparePassword, hashPassword } from '../utils/password.js';
import type { LoginInput, RegisterInput } from '../validators/auth.validator.js';



export const register = async (input:RegisterInput) => {
    const existingUser = await findUserByEmail(input.email);
    if (existingUser) {
        throw new Error('EMAIL_ALREADY_EXISTS')
    }

    const hashedPassword = await hashPassword(input.password);
    const user = await  createUser({
        name : input.name,
        email : input.email,
        password : hashedPassword,
    });

    return {
        id: user.id,
        name: user.name,
        email: user.email,
        profile: user.profiles,
        createdAt: user.created_at
    }
}

export const login = async (input: LoginInput) => {
  const user = await findUserByEmailGetProfile(input.email);

  if (!user) {
    throw new Error('INVALID_CREDENTIALS');
  }

  if (!user.is_active) {
    throw new Error('USER_INACTIVE');
  }

  const passwordValid = await comparePassword(
    input.password,
    user.password,
  );

  if (!passwordValid) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const accessToken = generateAccessToken(user.id);

  return {
    accessToken,

    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      profile: user.profiles,
      createdAt: user.created_at,
    },
  };
};

export const getCurrentUser = async (userId: string) => {
  const user = await findUserById(userId);

  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  if (!user.is_active) {
    throw new Error('USER_INACTIVE');
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerifiedAt: user.email_verified_at,
    profile: user.profiles,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
  };
};