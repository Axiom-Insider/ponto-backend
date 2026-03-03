import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { CreateFuncionarioDto } from './dto/create-funcionario.dto';
import { UpdateFuncionarioDto } from './dto/update-funcionario.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { hashSync as bcryptHashSync } from 'bcrypt';
import { FuncionarioAll } from 'src/interfaces/funcionarioAll.type';
import { FuncionarioOne } from 'src/interfaces/funcionarioOne.type';
import { IGenerico } from 'src/interfaces/dados';
import { IMessage } from 'src/interfaces/message.type';
import { FuncionarioHorarioDto } from './dto/funcionario-horario.dto';

@Injectable()
export class FuncionarioService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createFuncionarioDto: CreateFuncionarioDto) {
    try {
      const found = await this.prisma.funcionarios.findMany({
        where: { OR: [{ cpf: createFuncionarioDto.cpf }] },
      });

      if (found.length > 0) {
        throw 'Funcionário já foi registrado';
      }
      createFuncionarioDto.senha = '123';
      await this.prisma.funcionarios.create({ data: createFuncionarioDto });
      return {
        message: 'Funcionário criado com sucesso',
        statusCode: HttpStatus.CREATED,
      };
    } catch (error) {
      throw new HttpException(`Erro ao criar Funcionário: ${error}`, HttpStatus.NOT_IMPLEMENTED);
    }
  }

  async findAll(): Promise<{ dados: {}; statusCode: HttpStatus }> {
    try {
      const dados = await this.prisma.funcionarios.findMany({
        where: { adm: false },
        select: {
          id: true,
          matricula: true,
          nome: true,
          cargo: true,
          cpf: true,
          turno: true,
        },
      });
      if (!dados || dados.length === 0) {
        throw 'Nenhum funcionário foi encontrado';
      }
      return { dados, statusCode: HttpStatus.OK };
    } catch (error) {
      throw new HttpException(
        `Erro ao consultar tabela funcionário: ${error}`,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async findId(id: number): Promise<IGenerico<FuncionarioOne>> {
    try {
      const dados = await this.prisma.funcionarios.findFirst({ where: { id } });
      if (dados === null) {
        throw 'Sem registros para a matrícula informada';
      }
      return { dados, statusCode: HttpStatus.OK };
    } catch (error) {
      throw new HttpException(
        `Erro ao consultar tabela funcionário: ${error}`,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async findCpf(cpf: string): Promise<IGenerico<FuncionarioOne>> {
    try {
      const dados = await this.prisma.funcionarios.findFirst({
        where: { cpf },
      });

      if (!dados) {
        throw 'Sem registro desse cpf';
      }
      return { dados, statusCode: HttpStatus.OK };
    } catch (error) {
      throw new HttpException(
        `Erro ao consultar a tabela funcionário: ${error}`,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async findNome(nome: string): Promise<{ dados: {}[]; statusCode: HttpStatus }> {
    try {
      const dados = await this.prisma.funcionarios.findMany({
        where: { nome: { contains: nome.toLowerCase() }, adm: false },
      });

      return { dados, statusCode: HttpStatus.OK };
    } catch (error) {
      throw new HttpException(
        `Erro ao consultar a tabela funcionário: ${error}`,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async resetarSenha(id: number) {
    try {
        await this.prisma.funcionarios.update({
        where: { id },
        data: { primeiraEntrada: false, senha: '123' },
      });

      return { message: 'Senha de funcionário resetada com sucesso', statusCode: HttpStatus.OK };
    } catch (error) {
      throw new HttpException(
        `Erro ao consultar a tabela funcionário: ${error}`,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async update(id: number, updateFuncionarioDto: UpdateFuncionarioDto): Promise<IMessage> {
    try {
      const found = await this.prisma.funcionarios.findUnique({
        where: { id },
      });
      if (!found) {
        throw 'Funcionario não existe';
      }

      const funcionario = await this.prisma.funcionarios.updateMany({
        where: { id },
        data: updateFuncionarioDto,
      });

      if (funcionario.count > 0) {
        const nomeSeparado = found.nome.split(' ');
        var nome = `${nomeSeparado[0]} ${nomeSeparado[1]}`;
        if (nomeSeparado[1].toLowerCase() === 'do' || nomeSeparado[1].toLowerCase() === 'de') {
          nome = `${nomeSeparado[0]} ${nomeSeparado[1]} ${nomeSeparado[2]}`;
        }
        return {
          message: `Os Dados De ${nome} Foram Atualizado Com Sucesso`,
          statusCode: HttpStatus.OK,
        };
      }
      throw 'Nenhuma dados foi atualizado';
    } catch (error) {
      throw new HttpException(`Erro ao atualizar dados: ${error}`, HttpStatus.NOT_MODIFIED);
    }
  }

  remove(id: number) {
    return `This action removes a #${id} funcionario`;
  }
}
