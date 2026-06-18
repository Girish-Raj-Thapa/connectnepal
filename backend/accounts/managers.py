from django.contrib.auth.models import BaseUserManager

class AccountManager(BaseUserManager):

    # normal user 
    def create_user(self, email, role, password=None):

        if not email:
            raise ValueError("User must have an email address.")
        
        email = self.normalize_email(email.lower().strip())

        user = self.model(
            email=email,
            role=role,
        )

        user.set_password(password) # Password hashing

        user.is_active = False 

        user.save(using=self._db)

        return user 
    

    def create_superuser(self, email, role, password=None):

        user = self.create_user(
            email=email,
            password=password,
            role=role 
        )


        user.is_admin = True
        user.is_staff = True
        user.is_active = True  # Superusers activated by default
        user.is_superuser = True

        user.save(using=self._db)

        return user 

