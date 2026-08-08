import asyncio
import sys
sys.path.append("/home/vssc/Desktop/DCM/Backend")

from database import db

async def main():
    print("Checking mail_config document in DB:")
    config_col = db.get_collection("mail_config")
    config = await config_col.find_one({"_id": "mail_config"})
    if config:
        print("Mail Config Document:")
        for k, v in config.items():
            if k == "password":
                print(f"  {k}: [REDACTED]")
            else:
                print(f"  {k}: {v}")
    else:
        print("No mail_config document found!")

if __name__ == "__main__":
    asyncio.run(main())
