import mongoose from 'mongoose';
import { env } from './env.js';
import { dbSchemas } from '@bot/constants';

await mongoose.connect(env.MONGO_URI.toString());

export const storageModel = mongoose.model('storage', dbSchemas.storageSchema);
export const usersModel = mongoose.model('users', dbSchemas.usersSchema);
export const jobsModel = mongoose.model('jobs', dbSchemas.jobsSchema);
