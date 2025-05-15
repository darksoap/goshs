// Package ca will handle the creation of certificates for TSL encrypted communication
// Credits: Shane Utt
// https://shaneutt.com/blog/golang-ca-and-signed-cert-go/
package ca

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"os"

	// disable G505 (CWE-327): Blocklisted import crypto/sha1: weak cryptographic primitive
	// #nosec G505
	"crypto/sha1"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/patrickhener/goshs/logger"
	"github.com/patrickhener/goshs/utils"
)

// Sum will give the sha256 and sha1 sum of the certificate
func Sum(cert []byte) (sha256s, sha1s string) {
	// Building sha256 sum
	f256 := sha256.Sum256(cert)
	sha256s = fmt.Sprintf("%X", f256)

	b := strings.Builder{}
	b.Grow(len(sha256s) + len(sha256s)/2 + 1)

	for i := 0; i < len(sha256s); i++ {
		b.WriteByte(sha256s[i])
		if i%2 == 1 {
			b.WriteByte(' ')
		}
	}

	sha256s = b.String()

	// building sha1 sum
	// disable "G401 (CWE-326): Use of weak cryptographic primitive"
	// #nosec G401
	f1 := sha1.Sum(cert)
	sha1s = fmt.Sprintf("%X", f1)

	b = strings.Builder{}
	b.Grow(len(sha1s) + len(sha1s)/2 + 1)

	for i := 0; i < len(sha1s); i++ {
		b.WriteByte(sha1s[i])
		if i%2 == 1 {
			b.WriteByte(' ')
		}
	}

	sha1s = b.String()

	return sha256s, sha1s
}

// ParseAndSum will take the user provided cert and return the sha256 and sha1 sum
func ParseAndSum(cert string) (sha256s, sha1s string, err error) {
	// disable G304 (CWE-22): Potential file inclusion via variable
	// risk accepted, maybe check if can be used to do malicous things
	// #nosec G304
	certBytes, err := os.ReadFile(cert)
	if err != nil {
		return "", "", err
	}

	block, _ := pem.Decode(certBytes)
	if block == nil {
		return "", "", fmt.Errorf("failed to decode PEM block from cert")
	}

	certParsed, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return "", "", err
	}

	sha256s, sha1s = Sum(certParsed.Raw)

	return sha256s, sha1s, nil
}

// Setup will deliver a fully initialized CA and server cert
func Setup() (serverTLSConf *tls.Config, sha256s, sha1s string, err error) {
	randInt, err := utils.RandomNumber()
	if err != nil {
		logger.Errorf("when creating certificate: %+v", err)
	}
	ca := &x509.Certificate{
		SerialNumber: &randInt,
		Subject: pkix.Name{
			Organization:       []string{"hesec.de"},
			OrganizationalUnit: []string{"hesec.de"},
			CommonName:         "goshs - SimpleHTTPServer",
			Country:            []string{"DE"},
			Province:           []string{"BW"},
			Locality:           []string{"Althengstett"},
			StreetAddress:      []string{"Gopher-Street"},
			PostalCode:         []string{"75382"},
		},
		NotBefore:             time.Now(),
		NotAfter:              time.Now().AddDate(10, 0, 0),
		IsCA:                  true,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth},
		KeyUsage:              x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign,
		BasicConstraintsValid: true,
	}

	// create our private and public key
	caPrivKey, err := rsa.GenerateKey(rand.Reader, 4096)
	if err != nil {
		return nil, "", "", err
	}

	// create the CA
	caBytes, err := x509.CreateCertificate(rand.Reader, ca, ca, &caPrivKey.PublicKey, caPrivKey)
	if err != nil {
		return nil, "", "", err
	}

	// pem encode
	caPEM := new(bytes.Buffer)
	if err := pem.Encode(caPEM, &pem.Block{
		Type:  "CERTIFICATE",
		Bytes: caBytes,
	}); err != nil {
		logger.Errorf("encoding pem: %+v", err)
	}

	caPrivKeyPEM := new(bytes.Buffer)
	if err := pem.Encode(caPrivKeyPEM, &pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(caPrivKey),
	}); err != nil {
		logger.Errorf("encoding pem: %+v", err)
	}

	randInt, err = utils.RandomNumber()
	if err != nil {
		logger.Errorf("when creating certificate: %+v", err)
	}
	// set up our server certificate
	cert := &x509.Certificate{
		SerialNumber: &randInt,
		Subject: pkix.Name{
			Organization:       []string{"hesec.de"},
			OrganizationalUnit: []string{"hesec.de"},
			CommonName:         "goshs - SimpleHTTPServer",
			Country:            []string{"DE"},
			Province:           []string{"BW"},
			Locality:           []string{"Althengstett"},
			StreetAddress:      []string{"Gopher-Street"},
			PostalCode:         []string{"75382"},
		},
		IPAddresses:  []net.IP{net.IPv4(127, 0, 0, 1), net.IPv6loopback},
		NotBefore:    time.Now(),
		NotAfter:     time.Now().AddDate(10, 0, 0),
		SubjectKeyId: []byte{1, 2, 3, 4, 6},
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth, x509.ExtKeyUsageServerAuth},
		KeyUsage:     x509.KeyUsageDigitalSignature,
	}

	certPrivKey, err := rsa.GenerateKey(rand.Reader, 4096)
	if err != nil {
		return nil, "", "", err
	}

	certBytes, err := x509.CreateCertificate(rand.Reader, cert, ca, &certPrivKey.PublicKey, caPrivKey)
	if err != nil {
		return nil, "", "", err
	}

	certPEM := new(bytes.Buffer)
	if err := pem.Encode(certPEM, &pem.Block{
		Type:  "CERTIFICATE",
		Bytes: certBytes,
	}); err != nil {
		logger.Errorf("encoding pem: %+v", err)
	}

	certPrivKeyPEM := new(bytes.Buffer)
	if err := pem.Encode(certPrivKeyPEM, &pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(certPrivKey),
	}); err != nil {
		logger.Errorf("encoding pem: %+v", err)
	}

	serverCert, err := tls.X509KeyPair(certPEM.Bytes(), certPrivKeyPEM.Bytes())
	if err != nil {
		return nil, "", "", err
	}

	serverTLSConf = &tls.Config{
		Certificates: []tls.Certificate{serverCert},
		MinVersion:   tls.VersionTLS12,
	}

	sha256s, sha1s = Sum(certBytes)

	return
}
