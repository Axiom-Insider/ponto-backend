import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateAusenciaDto } from './dto/create-ausencia.dto';
import { UpdateAusenciaDto } from './dto/update-ausencia.dto';
import { Ausencia } from 'src/interfaces/ausencia';
import { PrismaService } from 'src/prisma/prisma.service';
import { IGenerico } from 'src/interfaces/dados';
import { IMessage } from 'src/interfaces/message.type';
import { toZonedTime } from 'date-fns-tz';

@Injectable()
export class AusenciaService {
  private readonly fusoHorario: string;

  constructor(private readonly prisma: PrismaService) {
    this.fusoHorario = 'America/Bahia';
  }

  async create(createAusenciaDto: CreateAusenciaDto): Promise<{}> {
    try {
      const { id_funcionario, tipoAusencia, dataInicio, dataFim } = createAusenciaDto;
      await this.prisma.ausencias.create({
        data: { dataInicio, dataFim, id_funcionario, tipoAusencia },
      });
      return { message: 'Ausência criada com sucesso', statusCode: HttpStatus.CREATED };
    } catch (error) {
      throw new HttpException(`Erro ao registrar ausência ${error.message}`, HttpStatus.CONFLICT);
    }
  }

  async findAll(): Promise<{}> {
    try {
      const dados = await this.prisma.ausencias.findMany();
      return { dados, statusCode: HttpStatus.CREATED };
    } catch (error) {
      throw new HttpException(`Erro ao registrar ausência ${error.message}`, HttpStatus.CONFLICT);
    }
  }

  async findOne(id_funcionario: number): Promise<{}> {
    try {
      const dadosAusencia = await this.prisma.ausencias.findMany({ where: { id_funcionario } });
      const ausencias = [];
      for (let index = 0; index < dadosAusencia.length; index++) {
        const { dataInicio, dataFim, tipoAusencia } = dadosAusencia[index];
        const tempInicio = dataInicio.split('-');
        const tempFim = dataFim.split('-');
        ausencias.push({
          dataInicio: `${tempInicio[2]}/${tempInicio[1]}${tempInicio[0]}`,
          dataFIm: `${tempFim[2]}/${tempFim[1]}${tempFim[0]}`,
          tipoAusencia,
        });
      }
      return { ausencias, statusCode: HttpStatus.OK };
    } catch (error) {
      throw new HttpException(`Erro ao registrar ausência ${error.message}`, HttpStatus.CONFLICT);
    }
  }

  async findMesAno(id_funcionario: number, mes: number, ano: number) {
    try {
      const dadosAusencia = await this.prisma.ausencias.findMany({ where: { id_funcionario } });
      const ausencias = [];
      for (let index = 0; index < dadosAusencia.length; index++) {
        const { dataInicio, dataFim, tipoAusencia, id } = dadosAusencia[index];
        const tempAnoInicio = dataInicio.split('-')[0];
        const tempMesInicio = dataInicio.split('-')[1];
        if (ano === +tempAnoInicio) {
          if (mes === +tempMesInicio) {
            ausencias.push({
              id,
              tipoAusencia,
              dataInicio,
              dataFim,
            });
            continue;
          }
        }
        const tempAnoFim = dataFim.split('-')[0];
        const tempMesFim = dataFim.split('-')[1];
        if (ano === +tempAnoFim) {
          if (mes === +tempMesFim) {
            ausencias.push({
              id,
              tipoAusencia,
              dataInicio,
              dataFim,
            });
            continue;
          }
        }
      }

      ausencias.forEach((dados) => {
        const { dataInicio, dataFim } = dados;
        var tempInicio = dataInicio.split('-');
        var tempFim = dataFim.split('-');
        dados.dataInicio = `${tempInicio[2]}-${tempInicio[1]}-${tempInicio[0]}`;
        dados.dataFim = `${tempFim[2]}-${tempFim[1]}-${tempFim[0]}`;
      });

      return ausencias;
    } catch (error) {
      throw new HttpException(
        `Erro ao consultar a tabela ausência ${error.message}`,
        HttpStatus.CONFLICT,
      );
    }
  }

  async findDadosAnos(id_funcionario: number): Promise<{ dados: {}; statusCode: HttpStatus }> {
    try {
      const dados = await this.prisma.$queryRaw`
      SELECT DISTINCT LEFT(dataInicio, 4) AS ano
      FROM Ausencias
      WHERE id_funcionario = ${id_funcionario}
      ORDER BY ano DESC
      `;

      return { dados, statusCode: HttpStatus.OK };
    } catch (error) {
      throw new HttpException(
        `Erro ao consultar tabela feriados: ${error.message}`,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async update(
    id: number,
    updateAusenciaDto: UpdateAusenciaDto,
  ): Promise<IMessage | HttpException> {
    try {
      await this.prisma.ausencias.update({ where: { id }, data: updateAusenciaDto });
      return { message: 'Ausência atualizada com sucesso', statusCode: HttpStatus.OK };
    } catch (error) {
      throw new HttpException(`Erro ao atualizar ausência ${error.message}`, HttpStatus.CONFLICT);
    }
  }

  async remove(id: number): Promise<IMessage | HttpException> {
    try {
      await this.prisma.ausencias.delete({ where: { id } });
      return { message: 'Ausência deletada com sucesso', statusCode: HttpStatus.OK };
    } catch (error) {
      throw new HttpException(`Erro ao deletar ausência ${error.message}`, HttpStatus.CONFLICT);
    }
  }
}
