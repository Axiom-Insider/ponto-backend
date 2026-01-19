import { HttpStatus } from "@nestjs/common";


export type AuthResponse =
  | LoginSuccessResponse
  | FirstAccessResponse;

export interface LoginSuccessResponse {
  type: 'sucesso';
  token: string;
  expiresIn: number;
  funcionario: {
    id: number;
    cpf: string;
    adm: boolean;
    primeiraEntrada: boolean;
  };
  statusCode: HttpStatus;
}

export interface FirstAccessResponse {
  type: 'primeiro_acesso';
  primeiraEntrada: boolean;
  statusCode: HttpStatus;
}
