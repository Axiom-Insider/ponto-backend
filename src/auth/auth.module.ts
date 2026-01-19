import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { FuncionarioService } from 'src/funcionario/funcionario.service';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports:[ 
    PassportModule,
    JwtModule.registerAsync({
    global:true,
    imports:[],
    useFactory:async (configService: ConfigService)=> ({
      secret:configService.get<string>('JWT_SECRET'),
      signOptions:{expiresIn: +configService.get<number>('JWT_EXPIRATION_TIME')}
    }),
    inject:[ConfigService]
  })],
  providers: [AuthService, FuncionarioService, JwtStrategy],
  controllers: [AuthController]
})
export class AuthModule {}
