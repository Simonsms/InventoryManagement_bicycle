import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { redisClient } from '../config/redis';
import { User } from '../entities/User';
import { RoleName } from '../entities/Role';

const userRepo = () => AppDataSource.getRepository(User);

interface TokenPayload {
  sub: number;
  storeId: number | null;
  role: RoleName;
}

function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as unknown as number,
  });
}

function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as unknown as number,
  });
}

export async function login(email: string, password: string) {
  const user = await userRepo().findOne({
    where: { email, isActive: true },
    relations: ['role'],
  });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return null;
  }

  const payload: TokenPayload = {
    sub: user.id,
    storeId: user.storeId,
    role: user.role.name,
  };

  return {
    accessToken: generateAccessToken(payload),
    refreshToken: generateRefreshToken(payload),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      storeId: user.storeId,
    },
  };
}

export async function logout(token: string) {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  const ttl = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 86400;
  if (ttl > 0) {
    await redisClient.set(`blacklist:${token}`, '1', 'EX', ttl);
  }
}

export async function refreshAccessToken(refreshToken: string) {
  try {
    const payload = jwt.verify(refreshToken, process.env.JWT_SECRET!) as unknown as TokenPayload;
    const newPayload: TokenPayload = {
      sub: payload.sub,
      storeId: payload.storeId,
      role: payload.role,
    };
    return { accessToken: generateAccessToken(newPayload) };
  } catch {
    return null;
  }
}
