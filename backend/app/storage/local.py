from pathlib import Path
from typing import BinaryIO

from app.services.exceptions import StorageError
from app.storage.base import StorageBackend


class LocalStorageBackend(StorageBackend):
    """Armazena anexos em diretório local com proteção contra path traversal."""

    def __init__(self, root: Path) -> None:
        self.root = root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def save(self, key: str, content: bytes) -> None:
        destination = self._resolve_key(key)
        destination.parent.mkdir(parents=True, exist_ok=True)

        # A escrita temporária reduz o risco de manter arquivo parcialmente
        # gravado caso o processo seja interrompido durante o upload.
        temporary = destination.with_name(f".{destination.name}.tmp")
        try:
            temporary.write_bytes(content)
            temporary.replace(destination)
        except OSError as exc:
            temporary.unlink(missing_ok=True)
            raise StorageError("Could not store attachment") from exc

    def open(self, key: str) -> BinaryIO:
        path = self._resolve_key(key)

        try:
            return path.open("rb")
        except FileNotFoundError as exc:
            raise StorageError("Attachment content not found") from exc
        except OSError as exc:
            raise StorageError("Could not read attachment") from exc

    def delete(self, key: str) -> None:
        path = self._resolve_key(key)

        try:
            path.unlink(missing_ok=True)
        except OSError as exc:
            raise StorageError("Could not delete attachment") from exc

    def exists(self, key: str) -> bool:
        return self._resolve_key(key).is_file()

    def _resolve_key(self, key: str) -> Path:
        """Mantém qualquer chave, inclusive uma vinda do banco, dentro da raiz."""
        candidate = (self.root / key).resolve()

        if candidate != self.root and self.root not in candidate.parents:
            raise StorageError("Invalid attachment storage key")

        return candidate
