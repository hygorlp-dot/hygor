# FaceNet-512 experimental

O arquivo `facenet_512.tflite` não é versionado neste repositório. Ele é
baixado por `scripts/baixar-modelo-facenet512.mjs` a partir do commit fixo
`aashup/face-auth@e470d77beb64e4062792d7b0ff0d50127f089db4` e só é aceito
quando o SHA-256 é
`f0dede2fdf5fd10248aad1d85393d2d40e3494464440bd8fccb2c957baa430b7`.

O modelo foi selecionado a partir do projeto open source FaceAuth para comparar
o reconhecimento FaceNet-512 com o MobileFaceNet-192 atual do MARCELL. O
servidor mantém os templates separados pelo campo `modelo`; nenhum vetor
192-d é comparado com um vetor 512-d.

A integração permanece experimental até a medição de falso aceite e falsa
rejeição em aparelho físico. A prova de vida e o registro fiscal continuam sendo
os fluxos próprios do MARCELL.
