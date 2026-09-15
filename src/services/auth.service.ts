import {
  createUser,
  findUserByEmail,
} from '../repositories/user.repository.js';

import { hashPassword } from '../utils/password.js';
import type { RegisterInput } from '../validators/auth.validator.js';

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