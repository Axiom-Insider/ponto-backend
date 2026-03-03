import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { CreateHorarioDto } from './dto/create-horario.dto';
import { UpdateHorarioDto } from './dto/update-horario.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { historico, IHistorico } from 'src/interfaces/historico';
import { IMessage } from 'src/interfaces/message.type';
import { IHorariosOne } from 'src/interfaces/horarios/horariosOne';
import { IHorariosAll } from 'src/interfaces/horarios/horariosAll';
import { toZonedTime } from 'date-fns-tz';
import { HorarioDoDia } from 'src/interfaces/horarios/horarioDoDia';
import { stat } from 'fs';
import { AusenciaService } from 'src/ausencia/ausencia.service';
import { FeriadosService } from 'src/feriados/feriados.service';
import { TipoTurno } from '@prisma/client';

@Injectable()
export class HorarioService {
  private readonly fusoHorario: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ausencias: AusenciaService,
    private readonly feriados: FeriadosService,
  ) {
    this.fusoHorario = 'America/Bahia';
  }

  horaHoje() {
    const data = new Date();
    const horas = data.getHours().toString().padStart(2, '0');
    const minutos = data.getMinutes().toString().padStart(2, '0');
    return `${horas}:${minutos}`;
  }

  nomeMes(num: number) {
    const date = new Date();
    date.setMonth(num - 1);

    return date.toLocaleString('default', { month: 'long' });
  }

  nomeDia(ano: number, mes: number, dia: number) {
    const data = new Date(ano, mes - 1, dia);
    const nomeDia = [
      'Domingo',
      'Segunda-feira',
      'Terça-feira',
      'Quarta-feira',
      'Quinta-feira',
      'Sexta-feira',
      'Sábado',
    ];

    return nomeDia[data.getDay()];
  }

  async registrarEntrada(createHorarioDto: CreateHorarioDto): Promise<IMessage> {
    try {
      const { id_funcionario } = createHorarioDto;
      const date = new Date();
      const dataCriada = new Date().toISOString().split('T')[0];
      const entrada = `${date.getHours() < 10 ? '0' + date.getHours() : date.getHours()}:${date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes()}`;

      const horarios = await this.prisma.horarios.findFirst({
        where: { dataCriada, id_funcionario },
      });

      if (horarios) {
        throw `Entrada já foi registrada no sistema`;
      }

      await this.prisma.horarios.create({
        data: { dataCriada, entrada, id_funcionario },
      });
      return {
        message: 'Entrada registrada com sucesso',
        statusCode: HttpStatus.CREATED,
      };
    } catch (error) {
      throw new HttpException(`Erro ao registrar entrada: ${error}`, HttpStatus.CONFLICT);
    }
  }

  async registrarSaida(createHorarioDto: CreateHorarioDto): Promise<IMessage> {
    try {
      const { id_funcionario } = createHorarioDto;
      const date = new Date();
      const dataCriada = new Date().toISOString().split('T')[0];
      const saida = `${date.getHours() < 10 ? '0' + date.getHours() : date.getHours()}:${date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes()}`;
      const horarios = await this.prisma.horarios.findFirst({
        where: { dataCriada, id_funcionario },
      });

      if (!horarios) {
        throw `Entrada não foi registrada ainda`;
      }

      if (horarios.saida) {
        throw `Saida já foi registrada no sistema`;
      }

      await this.prisma.horarios.updateMany({
        where: { id_funcionario, dataCriada },
        data: { saida },
      });
      return {
        message: 'Saída registrada com sucesso',
        statusCode: HttpStatus.CREATED,
      };
    } catch (error) {
      throw new HttpException(`Erro ao registrar entrada: ${error}`, HttpStatus.CONFLICT);
    }
  }
  async getHorarioDia(): Promise<HorarioDoDia> {
    try {
      const dataCriada = new Date().toISOString().split('T')[0];
      const horarios = await this.prisma.horarios.findMany({
        where: {
          dataCriada,
        },
        select: {
          entrada: true,
          saida: true,
          funcionarios: {
            select: {
              id: true,
            },
          },
        },
      });

      const dados = await this.prisma.funcionarios.findMany({
        where: { adm: false },
      });

      if (!dados) {
        return {
          message: 'Nenhum registro na tabela funcionários',
          statusCode: HttpStatus.NOT_FOUND,
        };
      }
      var funcionarios = [];
      dados.forEach((element) => {
        const { cargo, matricula, nome, id } = element;
        funcionarios.push({
          nome,
          cargo,
          matricula,
          id,
          entrada: null,
          saida: null,
        });
      });

      if (!horarios) {
        return { funcionarios, statusCode: HttpStatus.OK };
      }

      horarios.forEach((horario) => {
        funcionarios.forEach((funcionario) => {
          if (funcionario.id === horario.funcionarios.id) {
            funcionario.entrada = horario.entrada;
            funcionario.saida = horario.saida;
          }
        });
      });
      return { funcionarios, statusCode: HttpStatus.OK };
    } catch (error) {
      throw new HttpException(`Erro ao encontrar dados de horarios: ${error}`, HttpStatus.CONFLICT);
    }
  }

  async editarHorarios(updateHorarioDto: UpdateHorarioDto) {
    try {
      const { id_funcionario, dataCriada, entrada, saida } = updateHorarioDto;
      const horarios = await this.prisma.horarios.findMany({
        where: { AND: [{ dataCriada, id_funcionario }] },
      });

      if (!horarios[0]) {
        if (!entrada) {
          throw 'Registre horario de entrada primeiro!';
        }

        await this.prisma.horarios.create({
          data: { dataCriada, entrada, id_funcionario },
        });
        return {
          message: 'Horario atualizado com sucesso',
          statusCode: HttpStatus.CREATED,
        };
      }

      if (!entrada) {
        await this.prisma.horarios.updateMany({
          where: { id: horarios[0].id },
          data: { saida },
        });
      }

      await this.prisma.horarios.updateMany({
        where: { id: horarios[0].id },
        data: { entrada },
      });

      return {
        message: 'Horario atualizado com sucesso',
        statusCode: HttpStatus.OK,
      };
    } catch (error) {
      throw new HttpException(`Erro ao editar horarios: ${error}`, HttpStatus.NOT_FOUND);
    }
  }

  async verificarHorarioDoFuncionario(id: number): Promise<{
    entrada: string | null;
    saida: string | null;
    message: string;
    statusCode: number;
  }> {
    try {
      const date = new Date();
      const dataCriada = date.toISOString().split('T')[0];

      const horarios = await this.prisma.horarios.findMany({
        where: { dataCriada, id_funcionario: id },
        select: {
          entrada: true,
          saida: true,
        },
      });

      if (!horarios[0]) {
        return {
          entrada: null,
          saida: null,
          message: 'Nenhum horario registrado para hoje',
          statusCode: HttpStatus.OK,
        };
      }

      const { saida, entrada } = horarios[0];

      return {
        entrada: !entrada ? null : entrada,
        saida: !saida ? null : saida,
        message: 'Horario encontrado com sucesso',
        statusCode: HttpStatus.OK,
      };
    } catch (error) {
      throw new HttpException(
        `Erro ao encontrar dados de horarios: ${error}`,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async dadosAnos(id_funcionario: number): Promise<{ dados: {}; statusCode: HttpStatus }> {
    try {
      const dados = await this.prisma.$queryRaw`
      SELECT DISTINCT LEFT(dataCriada, 4) AS ano
      FROM Horarios
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
  //para Pagina
  async getHistorico(id_funcionario: number, mes: number, ano: number) {
    try {
      console.log(id_funcionario, mes, ano);
      
      const ausencias = await this.ausencias.findMesAno(id_funcionario, mes, ano);
      const feriados = await this.feriados.findMesAno(mes, ano);
      const horarios = await this.prisma.horarios.findMany({
        where: {
          id_funcionario,
          dataCriada: {
            startsWith: `${ano}-${String(mes).padStart(2, '0')}`,
          },
        },
      });
      const qntDia = new Date(ano, mes, 0).getDate();
      const historico = [];

      for (let index = 1; index <= qntDia; index++) {
        historico.push({
          id: null,
          dia: index,
          nomeDia: this.nomeDia(ano, mes, index),
          entrada: ':',
          saida: ':',
          ausencia: null,
          feriado: null,
        });
      }
      horarios.forEach((horarios) => {
        const { entrada, saida, dataCriada, id } = horarios;
        const dia = +dataCriada.split('-')[2];
        historico.forEach((historico) => {
          if (historico.dia === dia) {
            historico.id = id;
            historico.entrada = entrada ? entrada : ':';
            historico.saida = saida ? saida : ':';
          }
        });
      });

      if (ausencias) {
        console.log(ausencias);
        
        ausencias.forEach((ausencia) => {
          const { dataInicio, dataFim, tipoAusencia } = ausencia;
          const mesInicio = +dataInicio.split('-')[1];
          const mesFim = +dataFim.split('-')[1];
          const diaInicio = +dataInicio.split('-')[0];
          const diaFim = +dataFim.split('-')[0];
          var qnt = diaFim - diaInicio;
          if (mesInicio == mesFim) {
            if (qnt < 1) {
              historico.forEach((dadosHistorico) => {
                if (diaInicio == dadosHistorico.dia) {
                  dadosHistorico.ausencia = `${tipoAusencia}`;
                }
              });
            } else {
              let novoDataInicio = diaInicio - 1;
              for (novoDataInicio; novoDataInicio < diaFim; novoDataInicio++) {
                historico[novoDataInicio].ausencia = `${tipoAusencia}`;
              }
            }
          } else {
            if (mesInicio == mes) {
              const dia = diaInicio;
              for (let novoDataInicio = dia - 1; novoDataInicio < qntDia; novoDataInicio++) {
                historico[novoDataInicio].ausencia = tipoAusencia;
              }
            }
            if (mesFim == mes) {
              var dia = diaFim;
              while (dia > 0) {
                dia--;
                historico[dia].ausencia = tipoAusencia;
              }
            }
          }
        });
      }

      if (feriados) {
        feriados.forEach((dadosFeriados) => {
          const { dataInicio, dataFim, nome } = dadosFeriados;
          const mesInicio = +dataInicio.split('-')[1];
          const mesFim = +dataFim.split('-')[1];
          const diaInicio = +dataInicio.split('-')[2];
          const diaFim = +dataFim.split('-')[2];
          var qnt = diaFim - diaInicio;
          if (mesInicio === mesFim) {
            if (qnt < 1) {
              historico.forEach((dadosHistorico) => {
                if (diaInicio === dadosHistorico.dia) {
                  dadosHistorico.feriado = `${nome}`;
                }
              });
            } else {
              for (let novoDataInicio = diaInicio - 1; novoDataInicio < diaFim; novoDataInicio++) {
                historico[novoDataInicio].feriado = nome;
              }
            }
          } else {
            if (mesInicio == mes) {
              const dia = diaInicio;
              for (let novoDataInicio = dia - 1; novoDataInicio < qntDia; novoDataInicio++) {
                historico[novoDataInicio].feriado = nome;
              }
            }
            if (mesFim == mes) {
              var dia = diaFim;
              while (dia > 0) {
                dia--;
                historico[dia].feriado = nome;
              }
            }
          }
        });
      }

      return { historico, statusCode: HttpStatus.OK };
    } catch (error) {
      throw new HttpException(
        `Erro ao encontrar dados de horarios: ${error}`,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  //para o pdf
  async getHistoricoFuncionario(
    id_funcionario: number,
    mes: number,
    ano: number,
  ): Promise<{ historico: {}; statusCode: number }> {
    try {
      const ausencias = await this.ausencias.findMesAno(id_funcionario, mes, ano);
      const feriados = await this.feriados.findMesAno(mes, ano);
      const horarios = await this.prisma.horarios.findMany({
        where: {
          id_funcionario,
          dataCriada: {
            startsWith: `${ano}-${String(mes).padStart(2, '0')}`,
          },
        },
      });
      const qntDia = new Date(ano, mes, 0).getDate();
      const historico = [];

      for (let index = 1; index <= qntDia; index++) {
        historico.push({
          d: index,
          dia:
            this.nomeDia(ano, mes, index) === 'Domingo' ||
            this.nomeDia(ano, mes, index) === 'Sábado'
              ? ''
              : this.nomeDia(ano, mes, index),
          do: this.nomeDia(ano, mes, index) === 'Domingo' ? 'D O M I N G O' : '',
          sa: this.nomeDia(ano, mes, index) === 'Sábado' ? 'Sábado' : '',
          entrada: ':',
          saida: ':',
          ausencias: '',
          feriados: '',
        });
      }

      if (horarios) {
        historico.forEach((dadosHisotrico) => {
          horarios.forEach((dadosHorarios) => {
            const { dataCriada, entrada, saida, id } = dadosHorarios;
            const anoH = dataCriada.split('-')[0];
            const mesH = dataCriada.split('-')[1];
            if (ano === +anoH) {
              if (mes === +mesH) {
                const dia = dataCriada.split('-')[2];
                if (dadosHisotrico.d === +dia) {
                  if (dadosHisotrico.nomeDia) dadosHisotrico.id = id;
                  dadosHisotrico.entrada = entrada === null ? ':' : entrada;
                  dadosHisotrico.saida = saida === null ? ':' : saida;
                }
              }
            }
          });
        });
      }

      if (ausencias) {
        ausencias.forEach((element) => {
          const { dataInicio, dataFim, tipoAusencia } = element;
          const mesInicio = +dataInicio.split('-')[1];
          const mesFim = +dataFim.split('-')[1];
          const diaInicio = +dataInicio.split('-')[2];
          const diaFim = +dataFim.split('-')[2];
          var qnt = diaFim - diaInicio;
          if (mesInicio == mesFim) {
            if (qnt < 1) {
              historico.forEach((dadosHistorico) => {
                if (diaInicio === dadosHistorico.d) {
                  dadosHistorico.ausencias = tipoAusencia;
                }
              });
            } else {
              let novoDataInicio = diaInicio - 1;
              for (novoDataInicio; novoDataInicio < diaFim; novoDataInicio++) {
                historico[novoDataInicio].ausencias = tipoAusencia;
              }
            }
          } else {
            if (mesInicio == mes) {
              const dia = diaInicio;
              for (let novoDataInicio = dia - 1; novoDataInicio < qntDia; novoDataInicio++) {
                historico[novoDataInicio].ausencias = tipoAusencia;
              }
            }
            if (mesFim == mes) {
              var dia = diaFim;
              while (dia > 0) {
                dia--;
                historico[dia].ausencias = tipoAusencia;
              }
            }
          }
        });
      }

      if (feriados) {
        feriados.forEach((dadosFeriados) => {
          const { dataInicio, dataFim, nome, tipoFeriado } = dadosFeriados;
          const mesInicio = +dataInicio.split('-')[1];
          const mesFim = +dataFim.split('-')[1];
          const diaInicio = +dataInicio.split('-')[2];
          const diaFim = +dataFim.split('-')[2];
          var qnt = diaFim - diaInicio;
          if (mesInicio === mesFim) {
            if (qnt < 1) {
              historico.forEach((dadosHistorico) => {
                if (diaInicio === dadosHistorico.d) {
                  dadosHistorico.feriados = `${tipoFeriado} = ${nome}`;
                }
              });
            } else {
              for (let novoDataInicio = diaInicio - 1; novoDataInicio < diaFim; novoDataInicio++) {
                historico[novoDataInicio].feriados = `${tipoFeriado} = ${nome}`;
              }
            }
          } else {
            if (mesInicio == mes) {
              const dia = diaInicio;
              for (let novoDataInicio = dia - 1; novoDataInicio < qntDia; novoDataInicio++) {
                historico[novoDataInicio].feriados = `${tipoFeriado} = ${nome}`;
              }
            }
            if (mesFim == mes) {
              var dia = diaFim;
              while (dia > 0) {
                dia--;
                historico[dia].feriados = `${tipoFeriado} = ${nome}`;
              }
            }
          }
        });
      }

      return { historico, statusCode: HttpStatus.OK };
    } catch (error) {
      throw new HttpException(
        `Erro ao encontrar dados de horarios: ${error}`,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  //A ROTDA TA AQUI KRL
  async getHistoricoFuncionarioConfianca(
    id_funcionario: number,
    mes: number,
    ano: number,
  ): Promise<{ historico: {}; statusCode: number }> {
    try {
      const ausencias = await this.ausencias.findMesAno(id_funcionario, mes, ano);
      const feriados = await this.feriados.findMesAno(mes, ano);
      const horarios = await this.prisma.horarios.findMany({
        where: {
          id_funcionario,
          dataCriada: {
            startsWith: `${ano}-${String(mes).padStart(2, '0')}`,
          },
        },
      });
      const funcionario = await this.prisma.funcionarios.findUnique({
        where: { id: id_funcionario },
        select: { turno: true },
      });

      const qntDia = new Date(ano, mes, 0).getDate();
      const historico = [];

      for (let index = 1; index <= qntDia; index++) {
        historico.push({
          d: index,
          di:
            this.nomeDia(ano, mes, index) === 'Domingo' ||
            this.nomeDia(ano, mes, index) === 'Sábado'
              ? ''
              : this.nomeDia(ano, mes, index),
          do: this.nomeDia(ano, mes, index) === 'Domingo' ? 'Domingo' : '',
          sa: this.nomeDia(ano, mes, index) === 'Sábado' ? 'Sábado' : '',
          p_e: '--------', //primeira entrada
          s_e: '--------', // segunda entrada
          p_s: '--------', //primeira saida
          s_s: '--------',
          au: '',
          f: '',
        });
      }
      historico.forEach((dadosHistorico) => {
        var minutos_entrada = Math.floor(Math.random() * 8) + 1;
        var minutos_saida = Math.floor(Math.random() * 10) + 1;
        dadosHistorico.p_e = `08:${minutos_entrada < 10 ? '0' + minutos_entrada : minutos_entrada}`;
        dadosHistorico.p_s = `12:${minutos_saida < 10 ? '0' + minutos_saida : minutos_saida}`;
        minutos_entrada = Math.floor(Math.random() * 8) + 1;
        minutos_saida = Math.floor(Math.random() * 10) + 1;
        dadosHistorico.s_e = `14:${minutos_entrada < 10 ? '0' + minutos_entrada : minutos_entrada}`;
        dadosHistorico.s_s = `18:${minutos_saida < 10 ? '0' + minutos_saida : minutos_saida}`;
      });

      if (ausencias) {
        ausencias.forEach((element) => {
          const { dataInicio, dataFim, tipoAusencia } = element;
          const mesInicio = +dataInicio.split('-')[1];
          const mesFim = +dataFim.split('-')[1];
          const diaInicio = +dataInicio.split('-')[2];
          const diaFim = +dataFim.split('-')[2];
          var qnt = diaFim - diaInicio;
          if (mesInicio == mesFim) {
            if (qnt < 1) {
              historico.forEach((dadosHistorico) => {
                if (diaInicio === dadosHistorico.d) {
                  dadosHistorico.au = tipoAusencia;
                }
              });
            } else {
              let novoDataInicio = diaInicio - 1;
              for (novoDataInicio; novoDataInicio < diaFim; novoDataInicio++) {
                historico[novoDataInicio].au = tipoAusencia;
                historico[novoDataInicio].p_e = '--------';
                historico[novoDataInicio].p_s = '--------';
                historico[novoDataInicio].s_e = '--------';
                historico[novoDataInicio].s_s = '--------';
              }
            }
          } else {
            if (mesInicio == mes) {
              const dia = diaInicio;
              for (let novoDataInicio = dia - 1; novoDataInicio < qntDia; novoDataInicio++) {
                historico[novoDataInicio].au = tipoAusencia;
                historico[novoDataInicio].p_e = '--------';
                historico[novoDataInicio].p_s = '--------';
                historico[novoDataInicio].s_e = '--------';
                historico[novoDataInicio].s_s = '--------';
              }
            }
            if (mesFim == mes) {
              var dia = diaFim;
              while (dia > 0) {
                dia--;
                historico[dia].au = tipoAusencia;
                historico[dia].p_e = '--------';
                historico[dia].p_s = '--------';
                historico[dia].s_e = '--------';
                historico[dia].s_s = '--------';
              }
            }
          }
        });
      }

      if (feriados) {
        feriados.forEach((dadosFeriados) => {
          const { dataInicio, dataFim, nome, tipoFeriado } = dadosFeriados;
          const mesInicio = +dataInicio.split('-')[1];
          const mesFim = +dataFim.split('-')[1];
          const diaInicio = +dataInicio.split('-')[2];
          const diaFim = +dataFim.split('-')[2];
          var qnt = diaFim - diaInicio;
          if (mesInicio === mesFim) {
            if (qnt < 1) {
              historico.forEach((dadosHistorico) => {
                if (diaInicio === dadosHistorico.d) {
                  dadosHistorico.f = ` ${tipoFeriado} = ${nome}`;
                  dadosHistorico.p_e = '--------';
                  dadosHistorico.p_s = '--------';
                  dadosHistorico.s_e = '--------';
                  dadosFeriados.s_s = '--------';
                }
              });
            } else {
              for (let novoDataInicio = diaInicio - 1; novoDataInicio < diaFim; novoDataInicio++) {
                historico[novoDataInicio].f = ` ${tipoFeriado} = ${nome}`;
                historico[novoDataInicio].p_e = '--------';
                historico[novoDataInicio].p_s = '--------';
                historico[novoDataInicio].s_e = '--------';
                historico[novoDataInicio].s_s = '--------';
              }
            }
          } else {
            if (mesInicio == mes) {
              const dia = diaInicio;
              for (let novoDataInicio = dia - 1; novoDataInicio < qntDia; novoDataInicio++) {
                historico[novoDataInicio].f = ` ${tipoFeriado} = ${nome}`;
                historico[novoDataInicio].p_e = '--------';
                historico[novoDataInicio].p_s = '--------';
                historico[novoDataInicio].s_e = '--------';
                historico[novoDataInicio].s_s = '--------';
              }
            }
            if (mesFim == mes) {
              var dia = diaFim;
              while (dia > 0) {
                dia--;
                historico[dia].f = ` ${tipoFeriado} = ${nome}`;
                historico[dia].p_e = '--------';
                historico[dia].p_s = '--------';
                historico[dia].s_e = '--------';
                historico[dia].s_s = '--------';
              }
            }
          }
        });
      }

      return { historico, statusCode: HttpStatus.OK };
    } catch (error) {
      throw new HttpException(
        `Erro ao encontrar dados de horarios: ${error}`,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async dadosDeHorarios(id_funcionario: number, mes: number, ano: number) {
    try {
      const { historico } = await this.getHistorico(id_funcionario, mes, ano);

      const horarios = await this.prisma.horarios.findMany({
        where: {
          id_funcionario,
          dataCriada: {
            startsWith: `${ano}-${String(mes).padStart(2, '0')}`,
          },
        },
      });

      if (horarios) {
        var totalH = [];
        horarios.forEach((horas) => {
          const { entrada, saida } = horas;
          if (entrada && saida) {
            const [h1, m1] = entrada.split(':').map(Number);
            const [h2, m2] = saida.split(':').map(Number);
            var temp1 = h1 * 60 + m1;
            var temp2 = h2 * 60 + m2;
            var temp = temp2 - temp1;
            if (temp < 0) temp += 24 * 60;
            totalH.push(temp);
          }
        });
      }
      const total = totalH.reduce((acc, min) => acc + min, 0);

      const totalHorasTrabalhada = String(Math.floor(total / 60)).padStart(2, '0');

      const mesAtual = new Date().getMonth() + 1;

      if (mesAtual != mes) {
        var faltas = 0;
        historico.forEach((element) => {
          const { entrada, saida, feriado, ausencia } = element;

          if (feriado) {
            faltas++;
          } else {
            if (ausencia) {
              faltas++;
            } else {
              if (entrada == ':' && saida == ':') {
                faltas++;
              }
            }
          }
        });
      } else {
        var faltas = 0;
      }

      return { faltas, totalHorasTrabalhada, statusCode: HttpStatus.OK };
    } catch (error) {
      throw new HttpException(
        `Erro ao encontrar dados de horarios: ${error}`,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  async apagarHorarario(id: number) {
    try {
      await this.prisma.horarios.delete({ where: { id } });
      return { message: 'Horário apagado com sucesso!', statusCode: HttpStatus.OK };
    } catch (error) {
      throw new HttpException(
        `Erro ao encontrar dados de horarios: ${error}`,
        HttpStatus.NOT_FOUND,
      );
    }
  }
}
