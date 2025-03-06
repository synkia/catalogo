import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Button, 
  CircularProgress,
  Slider, 
  FormControl,
  FormHelperText,
  Grid,
  Alert,
  Card,
  CardContent,
  Divider,
  LinearProgress
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ImageIcon from '@mui/icons-material/Image';
import DownloadIcon from '@mui/icons-material/Download';
import SettingsIcon from '@mui/icons-material/Settings';
import ArticleIcon from '@mui/icons-material/Article';

const PdfToJpg = () => {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [quality, setQuality] = useState(90);
  const [scale, setScale] = useState(1.5);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [downloadFilename, setDownloadFilename] = useState('');
  const [processProgress, setProcessProgress] = useState(0);
  const [processStatus, setProcessStatus] = useState('');
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pdfLibLoaded, setPdfLibLoaded] = useState(false);
  const [jszipLoaded, setJszipLoaded] = useState(false);

  // Carregar as bibliotecas dinamicamente
  useEffect(() => {
    const loadLibraries = async () => {
      // Carregar PDF.js
      if (!window.pdfjsLib) {
        try {
          const pdfScript = document.createElement('script');
          pdfScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
          pdfScript.async = true;
          document.body.appendChild(pdfScript);

          pdfScript.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
            setPdfLibLoaded(true);
            console.log('PDF.js carregado com sucesso!');
          };
        } catch (err) {
          console.error('Erro ao carregar biblioteca PDF.js:', err);
          setError('Não foi possível carregar as bibliotecas necessárias. Tente recarregar a página.');
        }
      } else {
        setPdfLibLoaded(true);
      }
      
      // Carregar JSZip
      if (!window.JSZip) {
        try {
          const zipScript = document.createElement('script');
          zipScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
          zipScript.async = true;
          document.body.appendChild(zipScript);

          zipScript.onload = () => {
            setJszipLoaded(true);
            console.log('JSZip carregado com sucesso!');
          };
        } catch (err) {
          console.error('Erro ao carregar biblioteca JSZip:', err);
          setError('Não foi possível carregar as bibliotecas necessárias. Tente recarregar a página.');
        }
      } else {
        setJszipLoaded(true);
      }
    };

    loadLibraries();
  }, []);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setFileName(selectedFile.name);
      setError(null);
      
      // Limpar download anterior
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
        setDownloadUrl(null);
      }
    } else {
      setFile(null);
      setFileName('');
      setError('Por favor, selecione um arquivo PDF válido.');
    }
  };

  const convertPageToImage = async (pdf, pageNumber, scale, quality) => {
    try {
      // Obter a página do PDF
      const page = await pdf.getPage(pageNumber);
      
      // Definir o tamanho da viewport
      const viewport = page.getViewport({ scale });
      
      // Criar um canvas para renderizar a página
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      // Renderizar a página no canvas
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      // Converter o canvas para imagem JPG
      return canvas.toDataURL('image/jpeg', quality / 100);
    } catch (err) {
      console.error('Erro ao converter página:', err);
      throw new Error(`Erro ao processar página ${pageNumber}: ${err.message}`);
    }
  };

  const handleProcessPdf = async () => {
    if (!file || !pdfLibLoaded || !jszipLoaded) {
      setError('Por favor, aguarde o carregamento das bibliotecas ou selecione um arquivo PDF válido.');
      return;
    }

    setLoading(true);
    setError(null);
    setProcessProgress(0);
    setProcessStatus('Preparando para processar o PDF...');
    setCurrentPage(0);
    
    // Limpar download anterior
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }

    try {
      // Ler o arquivo como ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Carregar o PDF
      const pdf = await window.pdfjsLib.getDocument(arrayBuffer).promise;
      
      setTotalPages(pdf.numPages);
      
      // Se houver apenas uma página, retorna uma imagem
      if (pdf.numPages === 1) {
        setProcessStatus('Convertendo página para JPG...');
        const imageSrc = await convertPageToImage(pdf, 1, scale, quality);
        
        // Criar um link de download para a imagem
        const fileNameWithoutExt = fileName.replace('.pdf', '');
        setDownloadFilename(`${fileNameWithoutExt}.jpg`);
        setDownloadUrl(imageSrc);
        setProcessProgress(100);
      } else {
        // Se houver múltiplas páginas, criar um arquivo ZIP
        const zip = new window.JSZip();
        
        // Processar cada página
        for (let i = 1; i <= pdf.numPages; i++) {
          setCurrentPage(i);
          setProcessStatus(`Processando página ${i} de ${pdf.numPages}...`);
          
          // Atualizar o progresso
          const progress = Math.round((i / pdf.numPages) * 100);
          setProcessProgress(progress);
          
          // Converter página para imagem
          const imageSrc = await convertPageToImage(pdf, i, scale, quality);
          
          // Extrair os dados da imagem removendo o cabeçalho ("data:image/jpeg;base64,")
          const imageData = imageSrc.split(',')[1];
          
          // Adicionar a imagem ao arquivo ZIP
          zip.file(`pagina_${i}.jpg`, imageData, {base64: true});
        }
        
        setProcessStatus('Gerando arquivo ZIP...');
        
        // Gerar o arquivo ZIP
        const zipBlob = await zip.generateAsync({
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        }, (metadata) => {
          // Atualizar progresso durante a compressão
          setProcessProgress(Math.round(metadata.percent));
        });
        
        // Criar URL para download
        const zipUrl = URL.createObjectURL(zipBlob);
        setDownloadUrl(zipUrl);
        
        // Definir nome do arquivo zip para download
        const fileNameWithoutExt = fileName.replace('.pdf', '');
        setDownloadFilename(`${fileNameWithoutExt}_imagens.zip`);
      }
      
      setProcessStatus('Processamento concluído!');
      setLoading(false);
    } catch (err) {
      console.error('Erro ao processar PDF:', err);
      setError(`Erro ao processar o PDF: ${err.message}`);
      setLoading(false);
      setProcessStatus('');
    }
  };

  const handleQualityChange = (event, newValue) => {
    setQuality(newValue);
  };

  const handleScaleChange = (event, newValue) => {
    setScale(newValue);
  };

  const handleDownload = () => {
    if (downloadUrl) {
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <Box sx={{ p: 2, maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        PDF para JPG
      </Typography>
      
      <Typography variant="body1" paragraph>
        Converta facilmente cada página de seus arquivos PDF em imagens JPG. 
        Para PDFs com múltiplas páginas, um arquivo ZIP contendo todas as imagens será gerado.
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Novo! Processamento 100% local
        </Typography>
        <Typography variant="body2">
          Esta ferramenta agora converte seus PDFs diretamente no navegador, sem enviar arquivos ao servidor.
          Isso significa maior privacidade, processamento mais rápido e sem limites de tamanho de arquivo!
        </Typography>
      </Alert>
      
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Como funciona:
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={4} sx={{ textAlign: 'center' }}>
              <ArticleIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
              <Typography variant="body2">
                1. Selecione um arquivo PDF
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={4} sx={{ textAlign: 'center' }}>
              <ImageIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
              <Typography variant="body2">
                2. Processamento local no seu navegador
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={4} sx={{ textAlign: 'center' }}>
              <DownloadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
              <Typography variant="body2">
                3. Baixe as imagens (ZIP para múltiplas páginas)
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box>
          <Box sx={{ mb: 3, textAlign: 'center' }}>
            <input
              accept="application/pdf"
              id="pdf-upload"
              type="file"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <label htmlFor="pdf-upload">
              <Button
                variant="contained"
                component="span"
                startIcon={<CloudUploadIcon />}
                sx={{ mb: 2 }}
                disabled={!pdfLibLoaded || !jszipLoaded}
              >
                Selecionar PDF
              </Button>
            </label>
            
            {(!pdfLibLoaded || !jszipLoaded) && (
              <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
                Carregando bibliotecas necessárias... {pdfLibLoaded ? '(PDF.js ✓)' : '(PDF.js ⌛)'} {jszipLoaded ? '(JSZip ✓)' : '(JSZip ⌛)'}
              </Typography>
            )}
            
            {fileName && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Arquivo selecionado: {fileName} ({(file.size / (1024 * 1024)).toFixed(2)}MB)
              </Typography>
            )}
          </Box>
          
          <Box sx={{ mb: 3 }}>
            <Button 
              variant="outlined" 
              size="small"
              startIcon={<SettingsIcon />}
              onClick={() => setShowAdvanced(!showAdvanced)}
              sx={{ mb: 2 }}
            >
              {showAdvanced ? 'Ocultar configurações avançadas' : 'Mostrar configurações avançadas'}
            </Button>
            
            {showAdvanced && (
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <Typography gutterBottom>
                      Qualidade da imagem: {quality}
                    </Typography>
                    <Slider
                      value={quality}
                      onChange={handleQualityChange}
                      min={10}
                      max={100}
                      step={5}
                      marks={[
                        { value: 10, label: '10' },
                        { value: 50, label: '50' },
                        { value: 100, label: '100' }
                      ]}
                    />
                    <FormHelperText>
                      Valores mais altos = melhor qualidade, arquivos maiores
                    </FormHelperText>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <Typography gutterBottom>
                      Escala: {scale.toFixed(1)}x
                    </Typography>
                    <Slider
                      value={scale}
                      onChange={handleScaleChange}
                      min={0.5}
                      max={3.0}
                      step={0.1}
                      marks={[
                        { value: 0.5, label: '0.5x' },
                        { value: 1.5, label: '1.5x' },
                        { value: 3.0, label: '3.0x' }
                      ]}
                    />
                    <FormHelperText>
                      Valores mais altos = imagens maiores e mais nítidas
                    </FormHelperText>
                  </FormControl>
                </Grid>
              </Grid>
            )}
          </Box>
          
          <Divider sx={{ my: 3 }} />
          
          <Box sx={{ textAlign: 'center' }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            
            {loading && (
              <Box sx={{ width: '100%', mb: 3 }}>
                <Typography variant="body2" gutterBottom>
                  {processStatus || 'Processando...'}
                </Typography>
                {totalPages > 1 && (
                  <Typography variant="caption" display="block" sx={{ mb: 1 }}>
                    Página {currentPage} de {totalPages}
                  </Typography>
                )}
                <LinearProgress 
                  variant="determinate" 
                  value={processProgress} 
                  sx={{ height: 10, borderRadius: 5 }}
                />
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {processProgress}% concluído
                </Typography>
              </Box>
            )}
            
            <Button
              onClick={handleProcessPdf}
              variant="contained"
              color="primary"
              disabled={!file || loading || !pdfLibLoaded || !jszipLoaded}
              sx={{ mr: 2 }}
            >
              {loading ? 'Processando...' : 'Converter para JPG'}
              {loading && <CircularProgress size={24} sx={{ ml: 1 }} />}
            </Button>
            
            {downloadUrl && (
              <Button
                variant="contained"
                color="secondary"
                startIcon={<DownloadIcon />}
                onClick={handleDownload}
              >
                Baixar {downloadFilename.endsWith('.zip') ? 'Arquivo ZIP' : 'Imagem JPG'}
              </Button>
            )}
          </Box>
        </Box>
      </Paper>
      
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          Dicas:
        </Typography>
        <Typography variant="body2">
          • Use qualidade mais alta (80-100) para documentos com texto pequeno ou detalhes finos.<br />
          • Para documentos simples, valores menores de qualidade (40-70) geralmente são suficientes.<br />
          • Aumente a escala para obter imagens maiores e mais nítidas (mais memória necessária).<br />
          • O processamento ocorre 100% localmente no seu navegador, sem enviar arquivos ao servidor.<br />
          • Arquivos muito grandes ou com muitas páginas podem demorar mais para processar.
        </Typography>
      </Box>
    </Box>
  );
};

export default PdfToJpg; 