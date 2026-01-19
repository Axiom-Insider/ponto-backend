import { Controller, Get, Post, Body, Patch, Param, Delete, Res, UseGuards } from '@nestjs/common';
import { FuncionarioService } from './funcionario.service';
import { CreateFuncionarioDto } from './dto/create-funcionario.dto';
import { UpdateFuncionarioDto } from './dto/update-funcionario.dto';
import { Response } from 'express';
import { AuthGuard } from 'src/auth/auth.guard';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('funcionario')
export class FuncionarioController {
  constructor(private readonly funcionarioService: FuncionarioService) {}

  @Post()
  async create(@Body() createFuncionarioDto: CreateFuncionarioDto, @Res() res: Response) {
    const funcionario = await this.funcionarioService.create(createFuncionarioDto);
    return res.status(funcionario.statusCode).json(funcionario);
  }

  @Get()
  async findAll(@Res() res: Response) {
    const findAll = await this.funcionarioService.findAll();
    return res.status(findAll.statusCode).json(findAll.dados);
  }

  @Get(':id')
  async findOne(@Res() res: Response, @Param('id') id: string): Promise<{}> {
    const findOne = await this.funcionarioService.findId(+id);
    return res.status(findOne.statusCode).json(findOne.dados);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateFuncionarioDto: UpdateFuncionarioDto,
    @Res() res: Response,
  ) {
    const funcionario = await this.funcionarioService.update(+id, updateFuncionarioDto);
    return res.status(funcionario.statusCode).json(funcionario);
  }

  @Get('/buscar/:nome')
  async buscar(@Res() res: Response, @Param('nome') nome: string) {
    const dados = await this.funcionarioService.findNome(nome);
    return res.status(dados.statusCode).json(dados.dados);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.funcionarioService.remove(+id);
  }
}
