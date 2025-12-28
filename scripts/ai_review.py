import requests
import os
import sys

def main():
    try:
        # Check environment variables
        gemini_key = os.getenv("GEMINI_KEY")
        gitea_token = os.getenv("GITEA_TOKEN")
        
        if not gemini_key:
            print("Error: GEMINI_KEY environment variable is not set.")
            sys.exit(1)
        if not gitea_token:
            print("Error: GITEA_TOKEN environment variable is not set.")
            sys.exit(1)
            
        print("Starting AI Review process...")

        # 1. Get PR Diff
        # Need to construct URLs from context, which is tricky in pure script without context args.
        # But we can pass them as env vars or args. Let's use env vars injected by workflow.
        
        server_url = os.getenv("GITEA_SERVER_URL")
        repo = os.getenv("GITEA_REPO")
        pr_number = os.getenv("GITEA_PR_NUMBER")
        
        if not server_url or not repo or not pr_number:
             print(f"Error: Missing context env vars. Server: {server_url}, Repo: {repo}, PR: {pr_number}")
             # Fallback logic if needed, but let's assume workflow sends them.
             sys.exit(1)

        diff_url = f"{server_url}/api/v1/repos/{repo}/pulls/{pr_number}.diff"
        print(f"Fetching diff from: {diff_url}")
        
        diff_response = requests.get(diff_url, headers={'Authorization': f'token {gitea_token}'})
        if diff_response.status_code != 200:
             print(f"Error fetching diff: {diff_response.status_code} - {diff_response.text}")
             sys.exit(1)
             
        diff_data = diff_response.text
        if not diff_data:
            print("Diff is empty, nothing to review.")
            sys.exit(0)
            
        print(f"Diff fetched successfully ({len(diff_data)} chars). Sending to Gemini...")

        # 2. Ask Gemini
        prompt = f"Atue como um desenvolvedor Senior. Revise o seguinte Diff de código e aponte bugs, falhas de segurança ou melhorias. Seja direto e técnico:\n\n{diff_data[:30000]}" # Limit to avoid token limits
        
        api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key={gemini_key}"
        payload = {'contents': [{'parts': [{'text': prompt}]}]}
        
        response_req = requests.post(api_url, json=payload)
        response = response_req.json()
        
        if 'error' in response:
            print(f"Error from Gemini API: {response}")
            sys.exit(1)
            
        if 'candidates' not in response:
            print(f"Unexpected response format: {response}")
            sys.exit(1)

        review_text = response['candidates'][0]['content']['parts'][0]['text']
        print("Review generated successfully. Posting comment...")

        # 3. Post comment back to PR
        comment_url = f"{server_url}/api/v1/repos/{repo}/issues/{pr_number}/comments"
        
        comment_payload = {'body': f'### 🤖 AI Code Review\n\n{review_text}'}
        comment_response = requests.post(comment_url, json=comment_payload, headers={'Authorization': f'token {gitea_token}'})
        
        if comment_response.status_code not in [201, 200]:
            print(f"Error posting comment: {comment_response.status_code} - {comment_response.text}")
            sys.exit(1)
            
        print("Review posted successfully!")

    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
