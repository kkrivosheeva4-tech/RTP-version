import argparse
import ipaddress
import os
import ssl
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from socketserver import ThreadingMixIn
from wsgiref.simple_server import WSGIRequestHandler, WSGIServer, make_server

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID


DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8443
DEFAULT_HOSTNAMES = ("localhost", "127.0.0.1", "::1", "rtp3.localhost")


def parse_bind(value: str) -> tuple[str, int]:
    host, _, port = value.rpartition(":")
    if not host or not port:
        raise argparse.ArgumentTypeError("Bind must be in HOST:PORT format.")
    try:
        port_value = int(port)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("Port must be numeric.") from exc
    return host, port_value


def bootstrap_django() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    backend_dir = repo_root / "backend"
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")


def ensure_certificate(cert_path: Path, key_path: Path, hostnames: tuple[str, ...]) -> None:
    cert_path.parent.mkdir(parents=True, exist_ok=True)
    if cert_path.exists() and key_path.exists():
        return

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = x509.Name(
        [
            x509.NameAttribute(NameOID.COUNTRY_NAME, "RU"),
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "RTP-3 Local Development"),
            x509.NameAttribute(NameOID.COMMON_NAME, hostnames[0]),
        ]
    )

    alt_names: list[x509.GeneralName] = []
    for value in hostnames:
        try:
            alt_names.append(x509.IPAddress(ipaddress.ip_address(value)))
        except ValueError:
            alt_names.append(x509.DNSName(value))

    now = datetime.now(timezone.utc)
    certificate = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(private_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(minutes=5))
        .not_valid_after(now + timedelta(days=365))
        .add_extension(x509.SubjectAlternativeName(alt_names), critical=False)
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .sign(private_key, hashes.SHA256())
    )

    cert_path.write_bytes(certificate.public_bytes(serialization.Encoding.PEM))
    key_path.write_bytes(
        private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )


class ThreadedWSGIServer(ThreadingMixIn, WSGIServer):
    daemon_threads = True


class HTTPSRequestHandler(WSGIRequestHandler):
    def get_environ(self):
        environ = super().get_environ()
        environ["HTTPS"] = "on"
        environ["wsgi.url_scheme"] = "https"
        return environ


def main() -> int:
    parser = argparse.ArgumentParser(description="Run Django over HTTPS for local development.")
    parser.add_argument(
        "--bind",
        default=f"{DEFAULT_HOST}:{DEFAULT_PORT}",
        help="HTTPS bind address in HOST:PORT format.",
    )
    parser.add_argument(
        "--cert-dir",
        default="backend/.certs",
        help="Directory for generated local certificate files.",
    )
    parser.add_argument(
        "--cert-file",
        default="localhost-cert.pem",
        help="Certificate filename inside cert-dir.",
    )
    parser.add_argument(
        "--key-file",
        default="localhost-key.pem",
        help="Private key filename inside cert-dir.",
    )
    args = parser.parse_args()

    host, port = parse_bind(args.bind)
    bootstrap_django()

    from django.contrib.staticfiles.handlers import StaticFilesHandler
    from django.core.wsgi import get_wsgi_application

    repo_root = Path(__file__).resolve().parents[1]
    cert_dir = (repo_root / args.cert_dir).resolve()
    cert_path = cert_dir / args.cert_file
    key_path = cert_dir / args.key_file

    ensure_certificate(cert_path, key_path, DEFAULT_HOSTNAMES)

    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ssl_context.load_cert_chain(certfile=str(cert_path), keyfile=str(key_path))

    application = StaticFilesHandler(get_wsgi_application())
    httpd = make_server(
        host,
        port,
        application,
        server_class=ThreadedWSGIServer,
        handler_class=HTTPSRequestHandler,
    )
    httpd.socket = ssl_context.wrap_socket(httpd.socket, server_side=True)

    print(f"HTTPS development server is running at https://{host}:{port}/")
    print(f"Certificate: {cert_path}")
    print(f"Private key: {key_path}")
    print("Use Ctrl+C to stop.")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nHTTPS development server stopped.")
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
