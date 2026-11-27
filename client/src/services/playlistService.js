import axios from './axiosConfig';

export const getPlaylists = async () => {
    try {
        const res = await axios.get('/playlists');
        return res || [];
    } catch (error) {
        console.error('getPlaylists Error:', error);
        return [];
    }
};

export const createPlaylist = async ({ title, description = '', is_public = 1 }) => {
    try {
        const res = await axios.post('/playlists', { title, description, is_public });
        return res;
    } catch (error) {
        throw error.response?.data?.message || 'Lỗi tạo danh sách';
    }
};

export const updatePlaylist = async (id, data) => {
    try {
        const res = await axios.put(`/playlists/${id}`, data);
        return res;
    } catch (error) {
        throw error.response?.data?.message || 'Lỗi cập nhật danh sách';
    }
};

export const deletePlaylist = async (id) => {
    try {
        const res = await axios.delete(`/playlists/${id}`);
        return res;
    } catch (error) {
        throw error.response?.data?.message || 'Lỗi xóa danh sách';
    }
};

export const getPlaylistMovies = async (id) => {
    try {
        const res = await axios.get(`/playlists/${id}/movies`);
        return res || { playlist: null, movies: [] };
    } catch (error) {
        console.error('getPlaylistMovies Error:', error);
        throw error.response?.data?.message || 'Lỗi tải phim';
    }
};

export const addMovieToPlaylist = async (playlistId, movie) => {
    try {
        const res = await axios.post(`/playlists/${playlistId}/movies`, {
            slug: movie.slug,
            name: movie.name,
            thumb: movie.thumb_url || movie.thumb,
            quality: movie.quality || 'HD',
            year: movie.year || '2024',
            episode_current: movie.episode_current || 'Full',
            vote_average: movie.vote_average || 0
        });
        return res;
    } catch (error) {
        throw error.response?.data?.message || 'Lỗi thêm phim vào danh sách';
    }
};

export const removeMovieFromPlaylist = async (playlistId, slug) => {
    try {
        const res = await axios.delete(`/playlists/${playlistId}/movies/${slug}`);
        return res;
    } catch (error) {
        throw error.response?.data?.message || 'Lỗi gỡ phim khỏi danh sách';
    }
};

export const checkMovieInPlaylists = async (slug) => {
    if (!localStorage.getItem('token')) {
        return { inFavorites: false, inPlaylists: [] };
    }
    try {
        const res = await axios.get(`/playlists/check/${slug}`);
        return res || { inFavorites: false, inPlaylists: [] };
    } catch (error) {
        return { inFavorites: false, inPlaylists: [] };
    }
};

export const getPublicUserPlaylists = async (userId) => {
    try {
        const res = await axios.get(`/playlists/public/${userId}`);
        return res || [];
    } catch (error) {
        console.error('getPublicUserPlaylists Error:', error);
        return [];
    }
};
