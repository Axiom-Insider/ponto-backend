import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FuncionarioService } from 'src/funcionario/funcionario.service';
import { compareSync as bcryptCompareSync } from 'bcrypt';
import { hashSync as bcryptHashSync } from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { UpdateFuncionarioDto } from 'src/funcionario/dto/update-funcionario.dto';
import { LoginDto } from './dto/login.dto';
import { FuncionarioOne } from 'src/interfaces/funcionarioOne.type';
import { IMessage } from 'src/interfaces/message.type';
import { AuthResponse } from './dto/auth.dto';

@Injectable()
export class AuthService {
  private jwtEpiration: number;
  constructor(
    private readonly funcionarioService: FuncionarioService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.jwtEpiration = +this.configService.get<number>('JWT_EXPIRATION_TIME');
  }

  async signIn(loginDto: LoginDto): Promise<AuthResponse> {
    try {
      const { cpf, senha } = loginDto;
      const novaSenha = loginDto.novaSenha || null;
      const { dados } = await this.funcionarioService.findCpf(cpf);

      if (!dados) {
        throw 'Nenhum funcionário com essas credencias foi encontrado';
      }

      const funcionario = {
        id: dados.id,
        cpf: dados.cpf,
        adm: dados.adm,
        primeiraEntrada: dados.primeiraEntrada,
      };

      if (dados.primeiraEntrada) {
        if (bcryptCompareSync(senha, dados.senha)) {
          const payload = { sub: dados.id, username: dados.cpf };
          const token = this.jwtService.sign(payload);
          return {
            type:'sucesso',
            funcionario,
            token,
            expiresIn: this.jwtEpiration,
            statusCode: HttpStatus.OK,
          };
        }
        throw 'A Senha está incorreta';
      }

      if (senha != dados.senha) {
        throw "Senha incorreta. A senha para o primeiro acesso é '123'";
      }

      if (!novaSenha) {
        return { type:'primeiro_acesso', primeiraEntrada: funcionario.primeiraEntrada, statusCode: HttpStatus.ACCEPTED };
      }

      const updateFuncionarioDto: UpdateFuncionarioDto = {
        cpf,
        senha: bcryptHashSync(novaSenha, 10),
        primeiraEntrada: true,
      };

      await this.funcionarioService.update(dados.id, updateFuncionarioDto);
      return
    } catch (error) {
      throw new HttpException(`${error}`, HttpStatus.NOT_FOUND);
    }
  }
}
