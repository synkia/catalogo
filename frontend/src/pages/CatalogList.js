import React, { useState, useEffect, useCallback } from 'react';
import { 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  Button, 
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Alert,
  IconButton,
  Tooltip,
  LinearProgress
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import axios from 'axios';
import { API_URL } from '../utils/apiConfig';

// Configuração do Axios
const api = axios.create({
  baseURL: API_URL,
});

const CatalogList = () => {
  const navigate = useNavigate();
  const [catalogs, setCatalogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openUploadDialog, setOpenUploadDialog] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [files, setFiles] = useState([]);
  
  // Estados para controlar o diálogo de confirmação de exclusão
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [catalogToDelete, setCatalogToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Função para buscar catálogos
  const fetchCatalogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get('/catalogs/');
      
      // Ordenar catálogos por data de upload (mais recentes primeiro)
      const sortedCatalogs = [...response.data].sort((a, b) => {
        return new Date(b.upload_date) - new Date(a.upload_date);
      });
      
      setCatalogs(sortedCatalogs);
    } catch (err) {
      console.error('Erro ao buscar catálogos:', err);
      setError('Não foi possível carregar os catálogos. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalogs();
  }, [fetchCatalogs]);

  // Configuração do Dropzone
  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    console.log('Arquivos aceitos:', acceptedFiles);
    console.log('Arquivos rejeitados:', rejectedFiles);
    
    // Lidar com arquivos rejeitados
    if (rejectedFiles && rejectedFiles.length > 0) {
      console.log('Motivos de rejeição:', rejectedFiles.map(f => f.errors));
      setUploadError(`${rejectedFiles.length} arquivo(s) foram rejeitados. Verifique o formato e tamanho.`);
      
      // Se temos arquivos aceitos, ainda podemos continuar
      if (acceptedFiles.length > 0) {
        setFiles(acceptedFiles);
      }
      return;
    }
    
    if (acceptedFiles.length > 0) {
      // Validar cada arquivo
      const allValid = acceptedFiles.every(file => {
        const fileType = file.name.toLowerCase().split('.').pop();
        const validTypes = ['pdf', 'jpg', 'jpeg', 'png'];
        const isValid = validTypes.includes(fileType);
        if (!isValid) {
          console.log(`Arquivo inválido: ${file.name}, tipo: ${fileType}`);
        }
        return isValid;
      });

      if (allValid) {
        console.log('Todos os arquivos são válidos, salvando', acceptedFiles.length, 'arquivos');
        setFiles(acceptedFiles);
        setUploadError(null);
      } else {
        console.log('Alguns arquivos são inválidos');
        setUploadError('Alguns arquivos não são suportados. Use apenas PDF, JPG, JPEG ou PNG.');
      }
    } else {
      console.log('Nenhum arquivo aceito');
      setUploadError('Por favor, selecione pelo menos um arquivo PDF, JPG, JPEG ou PNG válido.');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    },
    maxFiles: 10, // Aumentar para permitir mais arquivos
    multiple: true  // Habilitar explicitamente seleção múltipla
  });

  // Função para fazer upload de catálogos
  const handleUpload = async () => {
    if (files.length === 0) {
      setUploadError('Por favor, selecione pelo menos um arquivo PDF, JPG, JPEG ou PNG para upload.');
      return;
    }

    // Validar todos os arquivos novamente por segurança
    const invalidFiles = files.filter(file => {
      const fileType = file.name.toLowerCase().split('.').pop();
      const validTypes = ['pdf', 'jpg', 'jpeg', 'png'];
      return !validTypes.includes(fileType);
    });

    if (invalidFiles.length > 0) {
      setUploadError(`${invalidFiles.length} arquivo(s) com formato não suportado. Use PDF, JPG, JPEG ou PNG.`);
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);
      setUploadProgress(0);
      
      // Contador para arquivos processados
      let processedCount = 0;
      let successCount = 0;
      let errorCount = 0;
      
      // Processar cada arquivo individualmente
      const uploadPromises = files.map(async (file) => {
        try {
          const formData = new FormData();
          formData.append('file', file);
          
          await api.post('/catalogs/', formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            },
            onUploadProgress: (progressEvent) => {
              // Aqui calculamos apenas o progresso do arquivo atual
              // Para um progresso global, seria necessária uma lógica mais complexa
            }
          });
          
          successCount++;
          return { success: true, filename: file.name };
        } catch (err) {
          console.error(`Erro ao fazer upload do arquivo ${file.name}:`, err);
          errorCount++;
          return { success: false, filename: file.name, error: err.message };
        } finally {
          processedCount++;
          // Atualizar o progresso geral
          setUploadProgress(Math.round((processedCount / files.length) * 100));
        }
      });
      
      // Aguardar todos os uploads terminarem
      const results = await Promise.all(uploadPromises);
      
      // Relatório de resultados
      if (errorCount === 0) {
        setUploadSuccess(true);
      } else if (successCount > 0) {
        setUploadError(`${successCount} arquivo(s) enviado(s) com sucesso. ${errorCount} arquivo(s) com erro.`);
      } else {
        setUploadError('Nenhum arquivo foi enviado com sucesso. Verifique se são válidos e tente novamente.');
      }
      
      // Atualizar a lista de catálogos após os uploads
      fetchCatalogs();
      
      // Limpar formulário após 3 segundos se houver pelo menos um sucesso
      if (successCount > 0) {
        setTimeout(() => {
          setFiles([]);
          setUploadSuccess(false);
          setOpenUploadDialog(false);
        }, 3000);
      }
      
    } catch (err) {
      console.error('Erro geral ao fazer upload dos catálogos:', err);
      setUploadError('Erro ao fazer upload. Verifique se os arquivos são válidos e tente novamente.');
    } finally {
      setUploading(false);
    }
  };
  
  // Função para abrir o diálogo de confirmação de exclusão
  const openDeleteDialog = (catalog) => {
    setCatalogToDelete(catalog);
    setDeleteDialogOpen(true);
  };
  
  // Função para fechar o diálogo de confirmação
  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setCatalogToDelete(null);
  };
  
  // Função para excluir um catálogo
  const handleDeleteCatalog = async () => {
    if (!catalogToDelete) return;
    
    try {
      setDeleting(true);
      
      // Chamada para a API para excluir o catálogo
      await api.delete(`/catalogs/${catalogToDelete.catalog_id}`);
      
      // Atualizar a lista de catálogos após a exclusão
      fetchCatalogs();
      
      // Fechar o diálogo
      closeDeleteDialog();
      
    } catch (err) {
      console.error('Erro ao excluir catálogo:', err);
      setError('Não foi possível excluir o catálogo. Tente novamente mais tarde.');
    } finally {
      setDeleting(false);
    }
  };

  // Renderizar status do catálogo
  const renderStatus = (status) => {
    switch (status) {
      case 'processing':
        return <Chip label="Processando" color="warning" size="small" />;
      case 'ready':
        return <Chip label="Pronto" color="success" size="small" />;
      case 'error':
        return <Chip label="Erro" color="error" size="small" />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  // Formatar data
  const formatDate = (dateString) => {
    const options = { 
      year: 'numeric', 
      month: 'numeric', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleDateString('pt-BR', options);
  };

  return (
    <Grid container spacing={3}>
      {/* Cabeçalho */}
      <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Typography variant="h4" gutterBottom>
            Catálogos
          </Typography>
          <Typography variant="subtitle1" color="textSecondary">
            Gerencie seus catálogos de produtos
          </Typography>
        </div>
        <div>
          <Button 
            variant="contained" 
            startIcon={<CloudUploadIcon />}
            onClick={() => setOpenUploadDialog(true)}
            sx={{ mr: 1 }}
          >
            Adicionar Catálogo
          </Button>
          <Tooltip title="Atualizar lista">
            <span>
              <IconButton onClick={fetchCatalogs} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
        </div>
      </Grid>
      
      {/* Mensagem de erro */}
      {error && (
        <Grid item xs={12}>
          <Alert severity="error">{error}</Alert>
        </Grid>
      )}
      
      {/* Lista de catálogos */}
      <Grid item xs={12}>
        <TableContainer component={Paper} elevation={2}>
          <Table sx={{ minWidth: 650 }} aria-label="tabela de catálogos">
            <TableHead>
              <TableRow>
                <TableCell>Nome do Arquivo</TableCell>
                <TableCell align="center">Páginas</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="center">Data de Upload</TableCell>
                <TableCell align="center">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                    <CircularProgress size={40} />
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Carregando catálogos...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : catalogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                    <Typography variant="body1">
                      Nenhum catálogo encontrado.
                    </Typography>
                    <Button 
                      variant="text" 
                      color="primary" 
                      onClick={() => setOpenUploadDialog(true)}
                      sx={{ mt: 1 }}
                    >
                      Adicionar seu primeiro catálogo
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                catalogs.map((catalog) => (
                  <TableRow key={catalog.catalog_id} hover>
                    <TableCell component="th" scope="row">
                      {catalog.filename}
                    </TableCell>
                    <TableCell align="center">{catalog.page_count}</TableCell>
                    <TableCell align="center">{renderStatus(catalog.status)}</TableCell>
                    <TableCell align="center">{formatDate(catalog.upload_date)}</TableCell>
                    <TableCell align="center">
                      <Tooltip title="Visualizar">
                        <span>
                          <IconButton 
                            color="primary"
                            onClick={() => navigate(`/catalogs/${catalog.catalog_id}`)}
                            disabled={catalog.status !== 'ready'}
                          >
                            <VisibilityIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Anotar">
                        <span>
                          <IconButton 
                            color="secondary"
                            onClick={() => navigate(`/annotate/${catalog.catalog_id}/1`)}
                            disabled={catalog.status !== 'ready'}
                          >
                            <EditIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Excluir">
                        <IconButton 
                          color="error"
                          onClick={() => openDeleteDialog(catalog)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Grid>
      
      {/* Dialog de Upload */}
      <Dialog
        open={openUploadDialog}
        onClose={() => !uploading && setOpenUploadDialog(false)}
        aria-labelledby="upload-dialog-title"
        maxWidth="md"
      >
        <DialogTitle id="upload-dialog-title">
          Adicionar Catálogos
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="textSecondary" paragraph>
              Selecione um ou mais arquivos PDF ou imagens (JPG, JPEG, PNG) contendo os catálogos de produtos que deseja processar.
            </Typography>
          </Box>
          
          {uploadError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {uploadError}
            </Alert>
          )}
          
          {uploadSuccess && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Catálogos enviados com sucesso! Redirecionando...
            </Alert>
          )}
          
          {/* Interface do Dropzone */}
          <div 
            {...getRootProps()} 
            className={`file-upload-dropzone ${isDragActive ? 'file-upload-active' : ''}`}
            style={{ pointerEvents: uploading ? 'none' : 'auto' }}
          >
            <input {...getInputProps()} multiple />
            {files.length > 0 ? (
              <Box>
                <Typography variant="body1" gutterBottom>
                  {files.length === 1 
                    ? "1 arquivo selecionado:" 
                    : `${files.length} arquivos selecionados:`}
                </Typography>
                
                {files.length <= 3 ? (
                  // Exibe detalhes completos se houver poucos arquivos
                  files.map((file, index) => (
                    <Box key={index} sx={{ ml: 2, mb: 0.5 }}>
                      <Typography variant="body2">
                        {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </Typography>
                    </Box>
                  ))
                ) : (
                  // Exibe resumo se houver muitos arquivos
                  <Box>
                    <Box sx={{ ml: 2, mb: 0.5 }}>
                      <Typography variant="body2">
                        {files.slice(0, 2).map(f => f.name).join(', ')} e mais {files.length - 2} arquivo(s)
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                      Tamanho total: {(files.reduce((total, file) => total + (file.size / 1024 / 1024), 0)).toFixed(2)} MB
                    </Typography>
                  </Box>
                )}
              </Box>
            ) : (
              <Box>
                <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                <Typography variant="body1">
                  {isDragActive ? 'Solte os arquivos aqui' : 'Arraste e solte um arquivo PDF ou imagem (JPG, JPEG, PNG) aqui, ou clique para selecionar'}
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                  Formatos aceitos: PDF, JPG, JPEG, PNG
                </Typography>
              </Box>
            )}
          </div>
          
          {/* Método alternativo de upload - input padrão do HTML */}
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
              Ou use o seletor de arquivos padrão:
            </Typography>
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => {
                console.log('Arquivos selecionados via input padrão:', e.target.files);
                const filesArray = Array.from(e.target.files || []);
                if (filesArray.length > 0) {
                  setFiles(filesArray);
                  setUploadError(null);
                }
              }}
              disabled={uploading}
              style={{ display: 'block', margin: '0 auto' }}
            />
          </Box>
          
          {uploading && (
            <Box sx={{ width: '100%', mt: 2 }}>
              <LinearProgress variant="determinate" value={uploadProgress} />
              <Typography variant="caption" display="block" textAlign="center" sx={{ mt: 1 }}>
                {uploadProgress}% concluído {files.length > 1 ? ` (${Math.ceil(uploadProgress * files.length / 100)}/${files.length} arquivos)` : ''}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setOpenUploadDialog(false)} 
            disabled={uploading}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleUpload} 
            variant="contained" 
            color="primary"
            disabled={files.length === 0 || uploading}
            startIcon={uploading ? <CircularProgress size={20} /> : <CloudUploadIcon />}
          >
            {uploading ? 'Enviando...' : 'Enviar Catálogos'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Dialog de Confirmação de Exclusão */}
      <Dialog
        open={deleteDialogOpen}
        onClose={closeDeleteDialog}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          Confirmar exclusão
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Tem certeza que deseja excluir o catálogo "{catalogToDelete?.filename}"?
          </Typography>
          <Typography variant="body2" color="error" sx={{ mt: 2 }}>
            Esta ação não pode ser desfeita e todas as anotações associadas serão perdidas.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog} disabled={deleting}>
            Cancelar
          </Button>
          <Button 
            onClick={handleDeleteCatalog} 
            color="error" 
            variant="contained"
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {deleting ? 'Excluindo...' : 'Excluir'}
          </Button>
        </DialogActions>
      </Dialog>
    </Grid>
  );
};

export default CatalogList;        