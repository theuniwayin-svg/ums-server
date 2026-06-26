import { Module, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import mongoose from 'mongoose';

const logger = new Logger('DatabaseModule');

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const uri =
          config.get<string>('MONGODB_URI') ||
          config.get<string>('MONGO_URI') ||
          config.get<string>('DATABASE_URL');
        const nodeEnv = config.get<string>('NODE_ENV');

        if (!uri) {
          throw new Error('Missing MongoDB connection string');
        }

        if (nodeEnv === 'development') {
          mongoose.set('debug', true);
        }

        return {
          uri,
          connectionFactory: (connection: mongoose.Connection) => {
            connection.on('connected', () => {
              logger.log('MongoDB connected');
            });
            connection.on('disconnected', () => {
              logger.warn('MongoDB disconnected');
            });
            connection.on('error', (err: Error) => {
              logger.error('MongoDB connection error');
            });
            return connection;
          },
        };
      },
    }),
  ],
})
export class DatabaseModule {}
