#!/usr/bin/env python3
"""Generate a NEW private OpenSearch TLS/auth bundle. Run with uv --with bcrypt.

Does not modify Kubernetes or rotate existing credentials. Back up this directory
encrypted before deploying. CA/admin private keys must NOT be mounted in the app.
"""
import argparse
import json
import os
from pathlib import Path
import secrets
import subprocess
import bcrypt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    os.umask(0o077)
    out = args.directory.resolve()
    out.mkdir(parents=True, exist_ok=False)
    tls = out / "tls"
    tls.mkdir()
    config = out / "security"
    config.mkdir()

    def openssl(*command):
        subprocess.run(["openssl", *command], cwd=tls, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    openssl("genpkey", "-algorithm", "RSA", "-pkeyopt", "rsa_keygen_bits:3072", "-out", "ca-key.pem")
    openssl("req", "-x509", "-new", "-sha256", "-days", "3650", "-key", "ca-key.pem", "-out", "ca.pem", "-subj", "/CN=Jaywiki Search CA", "-addext", "basicConstraints=critical,CA:TRUE", "-addext", "keyUsage=critical,keyCertSign,cRLSign")
    for name, cn in (("node", "secure-search"), ("admin", "jaywiki-search-admin")):
        openssl("genpkey", "-algorithm", "RSA", "-pkeyopt", "rsa_keygen_bits:2048", "-out", f"{name}-key.pem")
        openssl("req", "-new", "-key", f"{name}-key.pem", "-out", f"{name}.csr", "-subj", f"/CN={cn}")
        extensions = "basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\n"
        extensions += "extendedKeyUsage=serverAuth,clientAuth\n" if name == "node" else "extendedKeyUsage=clientAuth\n"
        if name == "node":
            extensions += "subjectAltName=DNS:localhost,IP:127.0.0.1,DNS:secure-search,DNS:secure-search.data,DNS:secure-search.data.svc,DNS:secure-search.data.svc.cluster.local,DNS:secure-search-0.secure-search.data.svc.cluster.local\n"
        (tls / f"{name}.ext").write_text(extensions)
        openssl("x509", "-req", "-in", f"{name}.csr", "-CA", "ca.pem", "-CAkey", "ca-key.pem", "-CAcreateserial", "-out", f"{name}.pem", "-days", "365", "-sha256", "-extfile", f"{name}.ext")
    password = secrets.token_hex(32)
    (out / "username").write_text("jaywiki")
    (out / "password").write_text(password)

    def write(name, body):
        (config / f"{name}.yml").write_text(json.dumps({"_meta": {"type": name, "config_version": 2}, **body}, indent=2) + "\n")

    write("internal_users", {"jaywiki": {"hash": bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)).decode(), "reserved": False, "backend_roles": []}})
    write("config", {"config": {"dynamic": {"http": {"anonymous_auth_enabled": False}, "authc": {"basic_internal_auth_domain": {"http_enabled": True, "transport_enabled": True, "order": 0, "http_authenticator": {"type": "basic", "challenge": True}, "authentication_backend": {"type": "intern"}}}}}})
    write("roles", {"jaywiki_app": {"cluster_permissions": ["cluster_composite_ops"], "index_permissions": [{"index_patterns": ["jaywiki-posts-v1", "jaywiki-articles-v1"], "allowed_actions": ["crud", "create_index", "indices:admin/refresh*", "indices:admin/exists", "indices:admin/get", "indices:admin/mapping/put"]}], "tenant_permissions": []}})
    write("rolesmapping", {})
    (config / "rolesmapping.yml").unlink()
    (config / "roles_mapping.yml").write_text(json.dumps({"_meta": {"type": "rolesmapping", "config_version": 2}, "jaywiki_app": {"users": ["jaywiki"], "backend_roles": [], "hosts": []}}, indent=2))
    for name in ("action_groups", "tenants", "nodes_dn"):
        write(name, {})
    write("allowlist", {"config": {"enabled": False, "requests": {}}})
    (out / "opensearch.yml").write_text('''cluster.name: jaywiki-secure-search
network.host: 0.0.0.0
discovery.type: single-node
plugins.security.disabled: false
plugins.security.allow_default_init_securityindex: true
plugins.security.ssl.transport.pemcert_filepath: tls/node.pem
plugins.security.ssl.transport.pemkey_filepath: tls/node-key.pem
plugins.security.ssl.transport.pemtrustedcas_filepath: tls/ca.pem
transport.ssl.enforce_hostname_verification: true
plugins.security.ssl.http.enabled: true
plugins.security.ssl.http.pemcert_filepath: tls/node.pem
plugins.security.ssl.http.pemkey_filepath: tls/node-key.pem
plugins.security.ssl.http.pemtrustedcas_filepath: tls/ca.pem
plugins.security.ssl.http.clientauth_mode: OPTIONAL
plugins.security.nodes_dn: ["CN=secure-search"]
plugins.security.authcz.admin_dn: ["CN=jaywiki-search-admin"]
''')
    print("Created private TLS/auth bundle; no credentials printed. Node certificate validity: 365 days.")


if __name__ == "__main__":
    main()
