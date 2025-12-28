import requests
import os
import sys

def main():
    try:
        # 1. Configurações de Ambiente
        gemini_key = os.getenv('GEMINI_KEY')
        gitea_token = os.getenv('GITEA_TOKEN')
        server_url = os.getenv('GITEA_SERVER_URL')
        repo = os.getenv('GITEA_REPO')
        pr_number = os.getenv('GITEA_PR_NUMBER')
        
        if not all([gemini_key, gitea_token, server_url, repo, pr_number]):
            print('Erro: Variáveis de ambiente incompletas.')
            sys.exit(1)

        print(f'Iniciando revisão para o PR #{pr_number} no repositório {repo}...')

        # 2. Busca o Diff do Pull Request
        diff_url = f'{server_url}/api/v1/repos/{repo}/pulls/{pr_number}.diff'
        headers = {'Authorization': f'token {gitea_token}'}
        
        diff_response = requests.get(diff_url, headers=headers, timeout=30)
        if diff_response.status_code != 200:
            print(f'Erro ao buscar diff: {diff_response.status_code}')
            sys.exit(1)
            
        diff_data = diff_response.text
        if not diff_data.strip():
            print('Diff vazio. Nada para revisar.')
            sys.exit(0)

        # 3. Preparação para o Gemini (v1 estável)
        # Usamos v1 e gemini-1.5-flash para suportar contextos longos
        api_url = f'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key={gemini_key}'
        
        # O 1.5 Flash suporta até 1 milhão de tokens
        prompt_text = f'Atue como um desenvolvedor Senior. Revise o seguinte código (Diff). Aponte bugs, falhas de segurança e melhorias. Responda em Português de forma direta:\n\n{diff_data[:200000]}'
        
        payload = {
            'contents': [{'parts': [{'text': prompt_text}]}],
            'generationConfig': {'temperature': 0.2} 
        }

        print(f'Enviando {len(diff_data[:200000])} caracteres para o Gemini 1.5 Flash...')
        
        response_req = requests.post(api_url, json=payload, timeout=60)
        response = response_req.json()
        
        if 'error' in response:
            print(f'Erro da API Gemini: {response["error"]["message"]}')
            sys.exit(1)

        if 'candidates' not in response:
            print(f'Erro: Resposta inesperada da API: {response}')
            sys.exit(1)

        review_text = response['candidates'][0]['content']['parts'][0]['text']
        print('Revisão gerada. Postando comentário no Gitea...')

        # 4. Posta o Comentário de volta no PR
        comment_url = f'{server_url}/api/v1/repos/{repo}/issues/{pr_number}/comments'
        comment_payload = {'body': f'### 🤖 AI Code Review (Gemini 1.5 Flash)\n\n{review_text}'}
        
        res_comment = requests.post(comment_url, json=comment_payload, headers=headers, timeout=30)
        
        if res_comment.status_code in [200, 201]:
            print('Revisão postada com sucesso!')
        else:
            print(f'Erro ao postar comentário: {res_comment.status_code}')

    except Exception as e:
        print(f'Ocorreu um erro inesperado: {str(e)}')
        sys.exit(1)

if __name__ == '__main__':
    main()