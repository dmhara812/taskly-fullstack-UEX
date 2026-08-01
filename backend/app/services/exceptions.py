class ServiceError(Exception):
    """Classe base para erros esperados da camada de service.

    Criar uma base comum facilita o tratamento global de erros depois,
    quando adicionarmos handlers no FastAPI.
    """

    status_code = 400
    detail = "Service error"

    def __init__(self, detail: str | None = None) -> None:
        if detail is not None:
            self.detail = detail

        super().__init__(self.detail)


class NotFoundError(ServiceError):
    """Erro para recursos não encontrados."""

    status_code = 404
    detail = "Resource not found"


class ConflictError(ServiceError):
    """Erro para conflitos de estado, como e-mail duplicado."""

    status_code = 409
    detail = "Resource already exists"


class ForbiddenError(ServiceError):
    """Erro para ações não permitidas para o usuário atual."""

    status_code = 403
    detail = "Forbidden"


class BadRequestError(ServiceError):
    """Erro para requisições inválidas do ponto de vista de negócio."""

    status_code = 400
    detail = "Bad request"


class UnsupportedMediaTypeError(ServiceError):
    """Erro para anexos com tipo declarado ou assinatura não permitidos."""

    status_code = 415
    detail = "Unsupported media type"


class PayloadTooLargeError(ServiceError):
    """Erro para arquivos que ultrapassam o limite configurado."""

    status_code = 413
    detail = "Payload too large"


class StorageError(ServiceError):
    """Erro de infraestrutura ao gravar, ler ou excluir conteúdo físico."""

    status_code = 500
    detail = "Attachment storage error"
