# File: check_network.py
import psutil
import time
import os

def main():
    """
    Skrip ini akan mencetak lalu lintas jaringan per detik untuk setiap antarmuka
    untuk mendiagnosis masalah pada pustaka psutil.
    """
    print("Memulai tes diagnostik jaringan... Tekan CTRL+C untuk berhenti.")
    print("="*60)
    
    last_counters = psutil.net_io_counters(pernic=True)
    
    try:
        while True:
            time.sleep(1)
            current_counters = psutil.net_io_counters(pernic=True)
            
            os.system('cls' if os.name == 'nt' else 'clear')
            print(f"Data Lalu Lintas Jaringan per Detik @ {time.strftime('%H:%M:%S')}")
            print("-" * 60)
            
            found_traffic = False
            for nic, current_io in current_counters.items():
                if nic in last_counters:
                    last_io = last_counters[nic]
                    
                    # Perhitungan kecepatan dalam Mbps
                    download_speed = ((current_io.bytes_recv - last_io.bytes_recv) * 8) / (1024 * 1024)
                    upload_speed = ((current_io.bytes_sent - last_io.bytes_sent) * 8) / (1024 * 1024)
                    
                    # Hanya tampilkan antarmuka yang memiliki aktivitas
                    if download_speed > 0.01 or upload_speed > 0.01:
                        print(f"  -> Antarmuka: {nic}")
                        print(f"     Download: {download_speed:.2f} Mbps")
                        print(f"     Upload:   {upload_speed:.2f} Mbps")
                        print("-" * 20) # Dipindahkan ke sini
                        found_traffic = True
                        
            if not found_traffic:
                print("Tidak ada lalu lintas jaringan signifikan yang terdeteksi.")
            
            last_counters = current_counters

    except KeyboardInterrupt:
        print("\nTes diagnostik dihentikan.")
    except Exception as e:
        print(f"\nTerjadi kesalahan: {e}")

if __name__ == "__main__":
    main()