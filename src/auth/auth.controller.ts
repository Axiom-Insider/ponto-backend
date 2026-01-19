import { Body, Post , Controller, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Response } from 'express'
import { LoginDto } from './dto/login.dto';
import { log } from 'console';

@Controller('auth')
export class AuthController {

    constructor(private readonly authService:AuthService){}

    @Post('login')
    async singIn(@Res() res:Response, @Body() loginDto: LoginDto){
        const auth =  await this.authService.signIn(loginDto)
        if(auth.type === 'sucesso'){
            console.log(auth, auth.token);
            res.cookie('access_token', auth.token, {
            httpOnly: true,   // 🔒 frontend NÃO acessa
            secure: false,    // true em produção com HTTPS
            sameSite: 'lax',
            maxAge: auth.expiresIn * 1000
        });
        return res.status(auth.statusCode).json(auth.funcionario)
        }

        return res.status(auth.statusCode).json(auth)

    }

}
